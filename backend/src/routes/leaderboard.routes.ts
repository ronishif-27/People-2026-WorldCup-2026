/**
 * routes/leaderboard.routes.ts
 *
 * GET /api/leaderboard?limit=50&offset=0&department=X&site=Y
 *
 * Ranks all USER-role players by coinBalance DESC, exactCorrectCount DESC, fullName ASC.
 * Global rank is always computed across the unfiltered universe (PRD LB-10).
 */

import { Router, Request, Response } from 'express';
import { db, C } from '../db/firebase.js';
import { requireAuth } from '../middleware/auth.middleware.js';

export const leaderboardRouter = Router();

leaderboardRouter.get('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const limit      = Math.min(Number(req.query.limit  ?? 50), 200);
  const offset     = Number(req.query.offset ?? 0);
  const department = req.query.department as string | undefined;
  const site       = req.query.site       as string | undefined;

  try {
    // Fetch ALL non-admin users — sort in JS to avoid requiring a Firestore
    // composite index on (role, coinBalance, exactCorrectCount). N is small
    // (≤ a few hundred employees), so client-side sort is the simpler choice.
    const allSnap = await db.collection(C.USERS)
      .where('role', '==', 'USER')
      .get();

    // Legacy fallback: pre-rewrite docs used `totalPoints` for the same field.
    const coinsOf = (d: FirebaseFirestore.DocumentData) =>
      (d.coinBalance ?? d.totalPoints ?? 0) as number;

    const allUsers = allSnap.docs
      .slice()
      .sort((a, b) => {
        const ad = a.data(), bd = b.data();
        const dc = coinsOf(bd) - coinsOf(ad);
        if (dc !== 0) return dc;
        return (bd.exactCorrectCount ?? 0) - (ad.exactCorrectCount ?? 0);
      })
      .map((doc, i) => {
        const d = doc.data();
        const exact   = d.exactCorrectCount  ?? 0;
        const winner  = d.winnerCorrectCount ?? 0;
        return {
          rank:               i + 1,
          userId:             doc.id,
          fullName:           d.fullName ?? doc.id,
          department:         d.department ?? '',
          site:               d.site ?? '',
          avatarUrl:          d.avatarUrl ?? null,
          exactCorrectCount:  exact,
          winnerCorrectCount: winner,
          hasParticipated:    d.hasParticipated ?? false,
          // Columns the Leaderboard table renders directly
          totalGames:         d.predictionCount ?? 0,
          totalWins:          exact + winner,
          coinBalance:        coinsOf(d),
        };
      });

    // Apply department/site filters AFTER ranking (rank stays global)
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
