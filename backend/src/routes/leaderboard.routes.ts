/**
 * routes/leaderboard.routes.ts
 *
 * GET /api/leaderboard?limit=50&offset=0&department=X&site=Y
 *
 * Ranks all USER-role players by totalPoints DESC, exactCorrectCount DESC, fullName ASC.
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
    // composite index on (role, totalPoints, exactCorrectCount). N is small
    // (≤ a few hundred employees), so client-side sort is the simpler choice.
    const allSnap = await db.collection(C.USERS)
      .where('role', '==', 'USER')
      .get();

    const allUsers = allSnap.docs
      .slice()
      .sort((a, b) => {
        const ad = a.data(), bd = b.data();
        const dp = (bd.totalPoints ?? 0) - (ad.totalPoints ?? 0);
        if (dp !== 0) return dp;
        return (bd.exactCorrectCount ?? 0) - (ad.exactCorrectCount ?? 0);
      })
      .map((doc, i) => ({
      rank:               i + 1,
      userId:             doc.id,
      fullName:           doc.data().fullName ?? doc.id,
      department:         doc.data().department ?? '',
      site:               doc.data().site ?? '',
      avatarUrl:          doc.data().avatarUrl ?? null,
      totalPoints:        doc.data().totalPoints ?? 0,
      exactCorrectCount:  doc.data().exactCorrectCount ?? 0,
      winnerCorrectCount: doc.data().winnerCorrectCount ?? 0,
      hasParticipated:    doc.data().hasParticipated ?? false,
    }));

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
