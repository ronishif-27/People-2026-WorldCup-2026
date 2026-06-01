/**
 * routes/users.routes.ts
 *
 * GET /api/users/me/stats  — stats for the header bar
 */

import { Router, Request, Response } from 'express';
import { db, C } from '../db/firebase.js';
import { requireAuth } from '../middleware/auth.middleware.js';

export const usersRouter = Router();

usersRouter.get('/me/stats', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.userId;

  try {
    const [userDoc, predsSnap, scoresSnap, allUsersSnap] = await Promise.all([
      db.collection(C.USERS).doc(userId).get(),
      db.collection(C.PREDICTIONS).where('userId', '==', userId).get(),
      db.collection(C.SCORES).where('userId', '==', userId).get(),
      // Sort in JS to avoid requiring a composite (role, coinBalance) index
      db.collection(C.USERS).where('role', '==', 'USER').get(),
    ]);

    if (!userDoc.exists) { res.status(404).json({ error: 'USER_NOT_FOUND' }); return; }

    const u             = userDoc.data()!;
    const placedBets    = predsSnap.size;
    const correctGuesses = scoresSnap.docs.filter(d => d.data().type === 'EXACT' || d.data().type === 'WINNER').length;
    const coinsOf = (d: FirebaseFirestore.DocumentData) => (d.coinBalance ?? d.totalPoints ?? 0) as number;
    const sortedUsers   = allUsersSnap.docs.slice().sort(
      (a, b) => coinsOf(b.data()) - coinsOf(a.data())
    );
    const rank          = sortedUsers.findIndex(d => d.id === userId) + 1;

    res.json({
      placedBets,
      correctGuesses,
      savedOutrights:     0,
      coinBalance:        coinsOf(u),
      exactCorrectCount:  u.exactCorrectCount ?? 0,
      winnerCorrectCount: u.winnerCorrectCount ?? 0,
      rank:               rank > 0 ? rank : null,
    });
  } catch (err) {
    console.error('[Users] /me/stats error:', err);
    res.status(500).json({ error: 'SERVER_ERROR' });
  }
});
