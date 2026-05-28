/**
 * routes/auth.routes.ts
 *
 * Google OAuth 2.0 authentication flow.
 *
 * Flow:
 *   1. GET /api/auth/google     → Redirect user's browser to Google consent screen
 *   2. GET /api/auth/callback   → Google redirects here with ?code=...
 *                                  • Exchange code for Google tokens
 *                                  • Fetch user profile from Google
 *                                  • Look up Department + Site in HiBob
 *                                  • Upsert User record in DB
 *                                  • Sign 24-hour JWT
 *                                  • Redirect to FRONTEND_URL with ?token=<jwt>
 *   3. GET /api/auth/me         → Return current user profile (requires Bearer token)
 *   4. POST /api/auth/logout    → Client-side only (JWT is stateless; client drops token)
 */

import { Router, Request, Response } from 'express';
import { OAuth2Client } from 'google-auth-library';
import crypto from 'crypto';
import { prisma } from '../db/prisma.js';
import { signToken } from '../services/jwt.service.js';
import { getEmployeeByEmail, getHiBobDepartments, getHiBobSites } from '../services/hibob.service.js';
import { requireAuth, requireAdmin } from '../middleware/auth.middleware.js';
import { config, adminEmails } from '../config.js';

export const authRouter = Router();

// ─── Google OAuth2 Client ─────────────────────────────────────────────────────

const oauth2Client = new OAuth2Client(
  config.GOOGLE_CLIENT_ID,
  config.GOOGLE_CLIENT_SECRET,
  config.GOOGLE_CALLBACK_URL
);

// Scopes: email + profile are sufficient (no need for broader Google Workspace access)
const GOOGLE_SCOPES = [
  'openid',
  'email',
  'profile',
];

// ─── In-memory state store (CSRF protection) ──────────────────────────────────
// State tokens are single-use and expire after 10 minutes.
// For multi-instance deployments, replace with Redis.
const pendingStates = new Map<string, number>(); // state → expiry timestamp

function generateState(): string {
  const state = crypto.randomBytes(32).toString('hex');
  pendingStates.set(state, Date.now() + 10 * 60 * 1000); // 10-minute TTL
  return state;
}

function validateAndConsumeState(state: string): boolean {
  const expiry = pendingStates.get(state);
  if (!expiry) return false;
  pendingStates.delete(state); // single-use
  return Date.now() < expiry;
}

// Clean up expired states every 15 minutes (avoids memory leak)
setInterval(() => {
  const now = Date.now();
  for (const [state, expiry] of pendingStates) {
    if (now > expiry) pendingStates.delete(state);
  }
}, 15 * 60 * 1000);

// ─── Route 1: Initiate OAuth ──────────────────────────────────────────────────

/**
 * GET /api/auth/google
 *
 * Redirects the browser to Google's OAuth consent screen.
 * Frontend links directly to this endpoint.
 */
authRouter.get('/google', (_req: Request, res: Response): void => {
  const state = generateState();

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline', // needed to get refresh_token (not used yet, but future-proof)
    scope: GOOGLE_SCOPES,
    state,
    prompt: 'select_account', // always show account picker (useful for multi-account users)
    hd: 'guesty.com',         // restrict to Guesty Workspace domain for extra security
  });

  res.redirect(authUrl);
});

// ─── Route 2: OAuth Callback ──────────────────────────────────────────────────

/**
 * GET /api/auth/callback
 *
 * Google redirects here after the user grants (or denies) access.
 * On success: creates/updates user, signs 24h JWT, redirects to frontend.
 * On failure: redirects to frontend with ?error=...
 */
authRouter.get('/callback', async (req: Request, res: Response): Promise<void> => {
  const { code, state, error: oauthError } = req.query as Record<string, string>;

  // ── User denied access ──────────────────────────────────────────────────────
  if (oauthError) {
    console.warn('[Auth] OAuth denied by user:', oauthError);
    res.redirect(`${config.FRONTEND_URL}?auth_error=access_denied`);
    return;
  }

  // ── Missing params ──────────────────────────────────────────────────────────
  if (!code || !state) {
    res.redirect(`${config.FRONTEND_URL}?auth_error=missing_params`);
    return;
  }

  // ── CSRF state validation ───────────────────────────────────────────────────
  if (!validateAndConsumeState(state)) {
    console.warn('[Auth] Invalid or expired OAuth state parameter');
    res.redirect(`${config.FRONTEND_URL}?auth_error=invalid_state`);
    return;
  }

  try {
    // ── Step 1: Exchange authorization code for Google tokens ─────────────────
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // ── Step 2: Fetch user profile from Google ────────────────────────────────
    const googleUser = await fetchGoogleUserInfo(tokens.id_token!);

    if (!googleUser.email) {
      console.error('[Auth] Google token is missing email claim');
      res.redirect(`${config.FRONTEND_URL}?auth_error=no_email`);
      return;
    }

    const email = googleUser.email.toLowerCase().trim();

    // ── Step 3: Fetch Department + Site from HiBob ────────────────────────────
    // Non-blocking: if HiBob is down, login still succeeds with defaults.
    const hibobData = await getEmployeeByEmail(email);

    if (hibobData) {
      console.info(
        `[Auth] HiBob data for ${email}: department="${hibobData.department}", site="${hibobData.site}"`
      );
    } else {
      console.warn(
        `[Auth] HiBob lookup failed for ${email} — using defaults (Unknown / Unknown)`
      );
    }

    // ── Step 4: Upsert user in database ──────────────────────────────────────
    const isAdmin = adminEmails.has(email);

    const user = await prisma.user.upsert({
      where: { email },
      update: {
        // Refresh from HiBob and Google on every login to catch name/dept changes
        fullName: hibobData?.fullName ?? googleUser.name ?? email.split('@')[0],
        googleId: googleUser.sub,
        department: hibobData?.department ?? 'Unknown',
        site: hibobData?.site ?? 'Unknown',
        // Promote to ADMIN if listed in ADMIN_EMAILS env var (never demote)
        ...(isAdmin ? { role: 'ADMIN' as const } : {}),
      },
      create: {
        email,
        fullName: hibobData?.fullName ?? googleUser.name ?? email.split('@')[0],
        googleId: googleUser.sub,
        department: hibobData?.department ?? 'Unknown',
        site: hibobData?.site ?? 'Unknown',
        role: isAdmin ? 'ADMIN' : 'USER',
      },
    });

    // ── Step 5: Sign 24-hour JWT ──────────────────────────────────────────────
    const token = signToken({
      userId: user.id,
      email: user.email,
      role: user.role as 'USER' | 'ADMIN', // SQLite stores as String; TS cast is safe
    });

    console.info(
      `[Auth] Login success: ${email} | role=${user.role} | ` +
      `dept="${user.department}" | site="${user.site}"`
    );

    // ── Step 6: Redirect to frontend with token ───────────────────────────────
    // The frontend reads ?token= from the URL, stores it in memory, then strips it.
    res.redirect(`${config.FRONTEND_URL}/auth/callback?token=${encodeURIComponent(token)}`);
  } catch (err) {
    console.error('[Auth] OAuth callback error:', err);
    res.redirect(`${config.FRONTEND_URL}?auth_error=server_error`);
  }
});

// ─── Route 3: Get Current User ────────────────────────────────────────────────

/**
 * GET /api/auth/me
 * Protected — requires Bearer token.
 *
 * Returns the current user's profile and T&C acceptance status.
 * The frontend calls this on every load to restore session state.
 */
authRouter.get('/me', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: {
        id: true,
        email: true,
        fullName: true,
        department: true,
        site: true,
        role: true,
        termsAcceptedAt: true,
        hasParticipated: true,
        createdAt: true,
      },
    });

    if (!user) {
      // User was deleted from DB after token was issued (edge case)
      res.status(401).json({
        error: 'USER_NOT_FOUND',
        message: 'Your account was not found. Please sign in again.',
      });
      return;
    }

    res.json({
      user: {
        ...user,
        termsAccepted: user.termsAcceptedAt !== null,
      },
    });
  } catch (err) {
    console.error('[Auth] /me error:', err);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to fetch user profile.' });
  }
});

// ─── Route 4a: Lists — departments + sites for onboarding dropdowns ───────────

/**
 * GET /api/auth/lists
 * Protected — requires Bearer token.
 *
 * Returns the live HiBob department and site lists (cached 1 h).
 * The onboarding modal fetches this to populate its dropdowns dynamically,
 * ensuring the options always reflect HiBob's source-of-truth data.
 */
authRouter.get('/lists', requireAuth, async (_req: Request, res: Response): Promise<void> => {
  try {
    const [departments, sites] = await Promise.all([
      getHiBobDepartments(),
      getHiBobSites(),
    ]);
    res.json({ departments, sites });
  } catch (err) {
    console.error('[Auth] /lists error:', err);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to fetch dropdown lists.' });
  }
});

// ─── Route 4b: Onboarding — save dept/site + accept T&C ──────────────────────

/**
 * POST /api/auth/onboarding
 * Protected — requires Bearer token.
 *
 * Called once per user after they confirm Department, Site, and T&C on the
 * onboarding modal.  Sets termsAcceptedAt and updates dept/site in the DB.
 * Also creates a TermsAcceptance audit record.
 *
 * Idempotent: safe to call again (re-updates dept/site, adds another acceptance row).
 */
authRouter.post('/onboarding', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { department, site } = req.body as { department?: string; site?: string };

  if (!department?.trim() || !site?.trim()) {
    res.status(400).json({ error: 'MISSING_FIELDS', message: 'department and site are required.' });
    return;
  }

  // Validate against live HiBob lists (source of truth)
  const [validDepts, validSites] = await Promise.all([
    getHiBobDepartments(),
    getHiBobSites(),
  ]);

  if (validDepts.length > 0 && !validDepts.includes(department)) {
    res.status(400).json({ error: 'INVALID_DEPARTMENT', message: `"${department}" is not a valid department.` });
    return;
  }

  if (validSites.length > 0 && !validSites.includes(site)) {
    res.status(400).json({ error: 'INVALID_SITE', message: `"${site}" is not a valid site.` });
    return;
  }

  try {
    const now = new Date();

    const [user] = await Promise.all([
      prisma.user.update({
        where: { id: req.user!.userId },
        data: { department, site, termsAcceptedAt: now },
        select: { id: true, email: true, fullName: true, department: true, site: true, role: true },
      }),
      prisma.termsAcceptance.create({
        data: {
          userId: req.user!.userId,
          acceptedAt: now,
          ipAddress: req.ip ?? null,
          version: 1,
        },
      }),
    ]);

    console.info(
      `[Auth] Onboarding complete: ${user.email} | dept="${department}" | site="${site}"`
    );

    res.json({ success: true, user: { ...user, termsAccepted: true } });
  } catch (err) {
    console.error('[Auth] /onboarding error:', err);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to save onboarding data.' });
  }
});

// ─── Route 5: HiBob connection test (admin only) ─────────────────────────────

/**
 * GET /api/auth/hibob-test
 * Protected — requires Bearer token + ADMIN role.
 *
 * Query params:
 *   ?email=someone@guesty.com  (optional — defaults to the calling user's email)
 *
 * Returns the raw HiBob data for the given email so we can verify field mapping
 * without going through a full login cycle.
 *
 * Example:
 *   curl -H "Authorization: Bearer <jwt>" \
 *        "http://localhost:8080/api/auth/hibob-test?email=roni.shif@guesty.com"
 */
authRouter.get('/hibob-test', requireAuth, requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const email = (req.query.email as string | undefined) ?? req.user!.email;

  try {
    const hibobData = await getEmployeeByEmail(email);

    if (!hibobData) {
      res.status(404).json({
        success: false,
        email,
        message: 'No employee found in HiBob for this email, or the API call failed. Check server logs for details.',
      });
      return;
    }

    res.json({ success: true, email, hibobData });
  } catch (err) {
    console.error('[Auth] /hibob-test error:', err);
    res.status(500).json({ success: false, error: 'SERVER_ERROR', message: String(err) });
  }
});

// ─── Route 6: Logout ─────────────────────────────────────────────────────────

/**
 * POST /api/auth/logout
 * Protected — requires Bearer token.
 *
 * JWT is stateless — the actual logout is done client-side by dropping
 * the token from memory. This endpoint exists so the frontend has a
 * clean API call to hook into for future server-side session management
 * (e.g., token blocklist).
 */
authRouter.post('/logout', requireAuth, (_req: Request, res: Response): void => {
  // Future: add token to a Redis blocklist here
  res.json({ success: true, message: 'Signed out successfully.' });
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Shape of the decoded Google ID token claims */
interface GoogleUserInfo {
  sub: string;      // Google User ID (stable, unique)
  email: string;
  name: string;
  picture?: string;
  hd?: string;      // Hosted domain (e.g. "guesty.com") — only present for Workspace users
}

/**
 * Decodes and verifies the Google ID token to extract user claims.
 * Uses google-auth-library's verifyIdToken for signature verification.
 */
async function fetchGoogleUserInfo(idToken: string): Promise<GoogleUserInfo> {
  const ticket = await oauth2Client.verifyIdToken({
    idToken,
    audience: config.GOOGLE_CLIENT_ID,
  });

  const payload = ticket.getPayload();
  if (!payload) throw new Error('Google ID token payload is empty');

  return {
    sub: payload.sub,
    email: payload.email ?? '',
    name: payload.name ?? '',
    picture: payload.picture,
    hd: payload.hd,
  };
}
