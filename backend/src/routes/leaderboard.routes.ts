/**
 * routes/leaderboard.routes.ts
 *
 * GET /api/leaderboard?limit=50&offset=0&department=X&site=Y
 *
 * Reads the in-memory leaderboard cache (per Cloud Run instance) instead of
 * scanning wc_users on every request. The cache is refreshed every 30s by a
 * background tick AND on every write that changes rankings (prediction save,
 * scoreMatch). See services/leaderboard-cache.service.ts for the design.
 *
 * Department / site filters are applied AFTER ranking, so the rank column
 * always reflects the user's GLOBAL position regardless of filter (PRD LB-10).
 */

import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import { getLeaderboard } from '../services/leaderboard-cache.service.js';

export const leaderboardRouter = Router();

leaderboardRouter.get('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const limit      = Math.min(Number(req.query.limit  ?? 50), 200);
  const offset     = Number(req.query.offset ?? 0);
  const department = req.query.department as string | undefined;
  const site       = req.query.site       as string | undefined;

  try {
    const allUsers = await getLeaderboard();

    let filtered = allUsers;
    if (department) filtered = filtered.filter(u => u.department === department);
    if (site)       filtered = filtered.filter(u => u.site === site);

    const page = filtered.slice(offset, offset + limit);

    res.json({
      total:       filtered.length,
      offset,
      limit,
      leaderboard: page,
    });
  } catch (err) {
    console.error('[Leaderboard] Error:', err);
    res.status(500).json({ error: 'SERVER_ERROR' });
  }
});
