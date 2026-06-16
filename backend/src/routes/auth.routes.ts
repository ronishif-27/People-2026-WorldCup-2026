/**
 * routes/auth.routes.ts — Firestore edition
 *
 * Google OAuth 2.0 flow + onboarding. All user records stored in Firestore wc_users.
 * User doc ID = email (unique, used as the userId in JWT payload).
 */

import { Router, Request, Response } from 'express';
import { OAuth2Client } from 'google-auth-library';
import crypto from 'crypto';
import { db, C, FieldValue } from '../db/firebase.js';
import { signToken } from '../services/jwt.service.js';
import { getEmployeeByEmail } from '../services/hibob.service.js';
import { requireAuth, requireAdmin } from '../middleware/auth.middleware.js';
import { config, adminEmails } from '../config.js';

export const authRouter = Router();

const oauth2Client = new OAuth2Client(config.GOOGLE_CLIENT_ID, config.GOOGLE_CLIENT_SECRET, config.GOOGLE_CALLBACK_URL);
const GOOGLE_SCOPES = ['openid', 'email', 'profile'];

// ─── CSRF state store ─────────────────────────────────────────────────────────

const pendingStates = new Map<string, number>();

function generateState(): string {
  const state = crypto.randomBytes(32).toString('hex');
  pendingStates.set(state, Date.now() + 10 * 60 * 1000);
  return state;
}

function validateAndConsumeState(state: string): boolean {
  const expiry = pendingStates.get(state);
  if (!expiry) return false;
  pendingStates.delete(state);
  return Date.now() < expiry;
}

setInterval(() => {
  const now = Date.now();
  for (const [s, exp] of pendingStates) { if (now > exp) pendingStates.delete(s); }
}, 15 * 60 * 1000);

// ─── Routes ───────────────────────────────────────────────────────────────────

authRouter.get('/google', (_req, res) => {
  const state = generateState();
  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline', scope: GOOGLE_SCOPES, state,
    prompt: 'select_account', hd: 'guesty.com',
  });
  res.redirect(url);
});

authRouter.get('/callback', async (req: Request, res: Response): Promise<void> => {
  const { code, state, error: oauthError } = req.query as Record<string, string>;

  if (oauthError) { res.redirect(`${config.FRONTEND_URL}?auth_error=access_denied`); return; }
  if (!code || !state) { res.redirect(`${config.FRONTEND_URL}?auth_error=missing_params`); return; }
  if (!validateAndConsumeState(state)) { res.redirect(`${config.FRONTEND_URL}?auth_error=invalid_state`); return; }

  try {
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);
    const googleUser = await fetchGoogleUserInfo(tokens.id_token!);

    if (!googleUser.email) { res.redirect(`${config.FRONTEND_URL}?auth_error=no_email`); return; }

    const email     = googleUser.email.toLowerCase().trim();
    const hibobData = await getEmployeeByEmail(email);
    const isAdmin   = adminEmails.has(email);
    const avatarUrl = hibobData?.avatarUrl ?? googleUser.picture ?? null;

    const userRef  = db.collection(C.USERS).doc(email);
    const existing = await userRef.get();

    const userData = {
      email,
      fullName:   hibobData?.fullName ?? googleUser.name ?? email.split('@')[0],
      googleId:   googleUser.sub,
      department: hibobData?.department ?? 'Unknown',
      site:       hibobData?.site ?? 'Unknown',
      avatarUrl,
      role:       isAdmin ? 'ADMIN' : (existing.exists ? existing.data()!.role : 'USER'),
      updatedAt:  new Date(),
    };

    if (!existing.exists) {
      await userRef.set({
        ...userData,
        totalPoints:        0,
        exactCorrectCount:  0,
        winnerCorrectCount: 0,
        hasParticipated:    false,
        termsAcceptedAt:    null,
        createdAt:          new Date(),
      });
    } else {
      await userRef.update(userData);
    }

    const user = (await userRef.get()).data()!;

    const token = signToken({ userId: email, email, role: user.role as 'USER' | 'ADMIN' });

    console.info(`[Auth] Login: ${email} | role=${user.role} | dept="${user.department}" | site="${user.site}"`);
    res.redirect(`${config.FRONTEND_URL}/auth/callback?token=${encodeURIComponent(token)}`);
  } catch (err) {
    console.error('[Auth] OAuth callback error:', err);
    res.redirect(`${config.FRONTEND_URL}?auth_error=server_error`);
  }
});

authRouter.get('/me', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const doc = await db.collection(C.USERS).doc(req.user!.userId).get();
    if (!doc.exists) { res.status(401).json({ error: 'USER_NOT_FOUND' }); return; }
    const u = doc.data()!;
    res.json({
      user: {
        id:               doc.id,
        email:            u.email,
        fullName:         u.fullName,
        department:       u.department,
        site:             u.site,
        avatarUrl:        u.avatarUrl ?? null,
        role:             u.role,
        termsAccepted:    u.termsAcceptedAt !== null,
        hasParticipated:  u.hasParticipated ?? false,
        totalPoints:      u.totalPoints ?? 0,
        exactCorrectCount: u.exactCorrectCount ?? 0,
      },
    });
  } catch (err) {
    console.error('[Auth] /me error:', err);
    res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

// ─── Onboarding ───────────────────────────────────────────────────────────────
//
// We validate department + site against the LIVE HiBob lists (same source the
// frontend dropdown is populated from). A stale hardcoded list would reject
// real HiBob values like "AI" that don't match our compile-time guess.

authRouter.post('/onboarding', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { department, site } = req.body as { department?: string; site?: string };

  if (!department || !site) { res.status(400).json({ error: 'MISSING_FIELDS' }); return; }

  // Validate against the same lists the frontend dropdown was populated from.
  // Lazy-import to avoid pulling hibob.service into module init order.
  const { getHiBobDepartments, getHiBobSites } = await import('../services/hibob.service.js');
  const [departments, sites] = await Promise.all([getHiBobDepartments(), getHiBobSites()]);
  // Case-insensitive trim match so minor whitespace/casing differences pass.
  const norm = (s: string) => s.trim().toLowerCase();
  const deptSet = new Set(departments.map(norm));
  const siteSet = new Set(sites.map(norm));

  if (!deptSet.has(norm(department))) {
    console.warn(`[Auth] /onboarding INVALID_DEPARTMENT: "${department}" not in HiBob list (${departments.length} entries)`);
    res.status(400).json({ error: 'INVALID_DEPARTMENT' }); return;
  }
  if (!siteSet.has(norm(site))) {
    console.warn(`[Auth] /onboarding INVALID_SITE: "${site}" not in HiBob list (${sites.length} entries)`);
    res.status(400).json({ error: 'INVALID_SITE' }); return;
  }

  try {
    const now     = new Date();
    const userRef = db.collection(C.USERS).doc(req.user!.userId);

    await Promise.all([
      userRef.update({ department, site, termsAcceptedAt: now }),
      db.collection(C.TERMS).add({ userId: req.user!.userId, acceptedAt: now, ipAddress: req.ip ?? null, version: 1 }),
    ]);

    const u = (await userRef.get()).data()!;
    res.json({ success: true, user: { id: userRef.id, email: u.email, fullName: u.fullName, department, site, role: u.role, termsAccepted: true } });
  } catch (err) {
    console.error('[Auth] /onboarding error:', err);
    res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

// ─── HiBob test (admin only) ──────────────────────────────────────────────────

authRouter.get('/hibob-test', requireAuth, requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const email = (req.query.email as string) || req.user!.email;
  const hibobData = await getEmployeeByEmail(email);
  if (!hibobData) { res.status(404).json({ error: 'NOT_FOUND', message: `No HiBob record for ${email}` }); return; }
  res.json({ email, hibobData });
});

// ─── Lists (dept + site from HiBob for onboarding dropdowns) ─────────────────

authRouter.get('/lists', requireAuth, async (_req, res) => {
  const { getHiBobDepartments, getHiBobSites } = await import('../services/hibob.service.js');
  const [departments, sites] = await Promise.all([getHiBobDepartments(), getHiBobSites()]);
  res.json({ departments, sites });
});

authRouter.post('/logout', requireAuth, (_req, res) => {
  res.json({ success: true });
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

interface GoogleUserInfo { sub: string; email: string; name: string; picture?: string; hd?: string; }

async function fetchGoogleUserInfo(idToken: string): Promise<GoogleUserInfo> {
  const ticket  = await oauth2Client.verifyIdToken({ idToken, audience: config.GOOGLE_CLIENT_ID });
  const payload = ticket.getPayload();
  if (!payload) throw new Error('Google ID token payload is empty');
  return { sub: payload.sub, email: payload.email ?? '', name: payload.name ?? '', picture: payload.picture, hd: payload.hd };
}
