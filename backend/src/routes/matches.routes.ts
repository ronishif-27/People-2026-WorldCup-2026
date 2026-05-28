/**
 * routes/matches.routes.ts — Firestore edition
 *
 * GET  /api/matches        — all matches ordered by kickoff
 * GET  /api/matches/live   — LIVE matches only
 * POST /api/matches/sync   — force-sync from football-data.org [ADMIN]
 * PATCH /api/matches/:id   — admin score/status override [ADMIN]
 */

import { Router, Request, Response } from 'express';
import { db, C } from '../db/firebase.js';
import { getAllMatches, getLiveMatches, syncMatchesFromApi } from '../services/football.service.js';
import { scoreMatch } from '../services/scoring.service.js';
import { requireAuth, requireAdmin } from '../middleware/auth.middleware.js';

export const matchesRouter = Router();

matchesRouter.get('/', requireAuth, async (_req, res) => {
  try {
    res.json(await getAllMatches());
  } catch (err) {
    console.error('[Matches] GET / error:', err);
    res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

matchesRouter.get('/live', requireAuth, async (_req, res) => {
  try {
    res.json(await getLiveMatches());
  } catch (err) {
    res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

matchesRouter.post('/sync', requireAuth, requireAdmin, async (_req, res) => {
  try {
    const result = await syncMatchesFromApi();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

// Admin override: update score/status and re-run scoring if FINISHED
matchesRouter.patch('/:id', requireAuth, requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const { scoreA, scoreB, status, minute } = req.body as {
    scoreA?: number; scoreB?: number; status?: string; minute?: string | null;
  };

  const matchRef = db.collection(C.MATCHES).doc(id);
  const existing = await matchRef.get();
  if (!existing.exists) { res.status(404).json({ error: 'MATCH_NOT_FOUND' }); return; }

  const update: Record<string, unknown> = { updatedAt: new Date() };
  if (scoreA  !== undefined) update.scoreA = scoreA;
  if (scoreB  !== undefined) update.scoreB = scoreB;
  if (status  !== undefined) update.status = status;
  if (minute  !== undefined) update.minute = minute;

  await matchRef.update(update);

  // Re-run scoring engine if admin is setting FINISHED (idempotent)
  if (status === 'FINISHED') {
    console.info(`[Admin] Triggering scoring for match ${id} (admin override)`);
    // Clear scoredAt so scoreMatch runs fresh
    await matchRef.update({ scoredAt: null });
    const { scored } = await scoreMatch(id);
    res.json({ success: true, scored });
    return;
  }

  res.json({ success: true });
});
