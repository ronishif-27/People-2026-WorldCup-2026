/**
 * routes/matches.routes.ts
 *
 * Serves World Cup match data from the local database (synced from football-data.org).
 *
 * Endpoints:
 *   GET  /api/matches          → All 104 WC matches, ordered by kick-off time
 *   GET  /api/matches/live     → Only currently LIVE matches
 *   POST /api/matches/sync     → Admin-only: force a fresh pull from football-data.org
 */

import { Router, Request, Response } from 'express';
import { requireAuth, requireAdmin } from '../middleware/auth.middleware.js';
import {
  getAllMatches,
  getLiveMatches,
  syncMatchesFromApi,
} from '../services/football.service.js';

export const matchesRouter = Router();

// ─── GET /api/matches ─────────────────────────────────────────────────────────

/**
 * Returns all World Cup matches sorted by kick-off time.
 * Requires a valid user session (any role).
 */
matchesRouter.get('/', requireAuth, async (_req: Request, res: Response): Promise<void> => {
  try {
    const matches = await getAllMatches();
    res.json({ matches, count: matches.length });
  } catch (err) {
    console.error('[Matches] GET / error:', err);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to fetch matches.' });
  }
});

// ─── GET /api/matches/live ────────────────────────────────────────────────────

/**
 * Returns only matches currently in LIVE status.
 * Useful for the frontend to poll for live score updates.
 */
matchesRouter.get('/live', requireAuth, async (_req: Request, res: Response): Promise<void> => {
  try {
    const matches = await getLiveMatches();
    res.json({ matches, count: matches.length });
  } catch (err) {
    console.error('[Matches] GET /live error:', err);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to fetch live matches.' });
  }
});

// ─── POST /api/matches/sync ───────────────────────────────────────────────────

/**
 * Admin-only: triggers an immediate sync from football-data.org.
 * The server also runs this automatically on startup and on a schedule.
 */
matchesRouter.post(
  '/sync',
  requireAuth,
  requireAdmin,
  async (_req: Request, res: Response): Promise<void> => {
    try {
      console.info('[Matches] Manual sync triggered by admin');
      const result = await syncMatchesFromApi();
      res.json({
        success: true,
        message: `Sync complete — ${result.synced} matches updated, ${result.errors} errors`,
        ...result,
      });
    } catch (err) {
      console.error('[Matches] POST /sync error:', err);
      res.status(500).json({ error: 'SERVER_ERROR', message: 'Sync failed.' });
    }
  }
);
