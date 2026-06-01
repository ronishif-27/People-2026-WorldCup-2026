/**
 * routes/predictions.routes.ts
 *
 * POST /api/predictions          — save/update a prediction (idempotent upsert)
 * GET  /api/predictions/me       — all predictions for current user
 * GET  /api/predictions/:matchId/consensus — aggregate win/draw/loss percentages
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { db, C, FieldValue } from '../db/firebase.js';
import { requireAuth } from '../middleware/auth.middleware.js';

export const predictionsRouter = Router();

const predSchema = z.object({
  matchId:        z.string().min(1),
  scoreA:         z.number().int().min(0).max(20),
  scoreB:         z.number().int().min(0).max(20),
  firstGoalRange: z.string().optional().nullable(),
});

// POST /api/predictions
predictionsRouter.post('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const parse = predSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(422).json({ error: 'VALIDATION_ERROR', issues: parse.error.issues });
    return;
  }

  const { matchId, scoreA, scoreB, firstGoalRange } = parse.data;
  const userId = req.user!.userId;

  if (req.user!.role === 'ADMIN') {
    res.status(403).json({ error: 'ADMIN_NO_PREDICT', message: 'Admins cannot submit predictions.' });
    return;
  }

  // Check T&C accepted
  const userDoc = await db.collection(C.USERS).doc(userId).get();
  if (!userDoc.exists || !userDoc.data()!.termsAcceptedAt) {
    res.status(403).json({ error: 'TERMS_NOT_ACCEPTED', message: 'Please accept the Terms & Conditions first.' });
    return;
  }

  // Check match exists and is not locked
  const matchDoc = await db.collection(C.MATCHES).doc(matchId).get();
  if (!matchDoc.exists) {
    res.status(404).json({ error: 'MATCH_NOT_FOUND' });
    return;
  }

  const match = matchDoc.data()!;

  // PRD: predictions are only accepted for Group Stage matches.
  // Knockout-round bets will be opened in a later phase.
  if (match.stage !== 'GROUP_STAGE') {
    res.status(423).json({
      error: 'STAGE_NOT_PREDICTABLE',
      message: 'Predictions are only open for Group Stage matches in this phase.',
    });
    return;
  }

  const kickoffAt = match.kickoffAt instanceof Date ? match.kickoffAt : match.kickoffAt.toDate();
  if (kickoffAt <= new Date()) {
    res.status(423).json({ error: 'MATCH_LOCKED', message: 'This match has already kicked off. Predictions are locked.' });
    return;
  }

  // Upsert prediction — doc ID = {userId}_{matchId}
  const predId  = `${userId}_${matchId}`;
  const predRef = db.collection(C.PREDICTIONS).doc(predId);
  const existing = await predRef.get();

  await db.runTransaction(async (t) => {
    const matchRef = db.collection(C.MATCHES).doc(matchId);

    // Remove old vote from match consensus counters
    if (existing.exists) {
      const old = existing.data()!;
      const oldKey = old.scoreA > old.scoreB ? 'winACount' : old.scoreA < old.scoreB ? 'winBCount' : 'drawCount';
      t.update(matchRef, { [oldKey]: FieldValue.increment(-1) });
    }

    // Save new prediction
    t.set(predRef, {
      userId, matchId,
      scoreA, scoreB,
      firstGoalRange: firstGoalRange ?? null,
      isSafePick: false,
      submittedAt: existing.exists ? existing.data()!.submittedAt : new Date(),
      updatedAt: new Date(),
    });

    // Add new vote to match consensus counters
    const newKey = scoreA > scoreB ? 'winACount' : scoreA < scoreB ? 'winBCount' : 'drawCount';
    t.update(matchRef, { [newKey]: FieldValue.increment(1) });
  });

  // Mark user as having participated
  if (!userDoc.data()!.hasParticipated) {
    await db.collection(C.USERS).doc(userId).update({ hasParticipated: true });
  }

  // Log activity event
  const user = userDoc.data()!;
  const matchLabel = `${match.teamA} vs ${match.teamB}`;
  await db.collection(C.ACTIVITY).add({
    userId,
    userName:   user.fullName ?? userId,
    department: user.department ?? '',
    site:       user.site ?? '',
    matchId,
    matchLabel,
    action:     'PREDICTED',
    score:      `${scoreA}-${scoreB}`,
    createdAt:  new Date(),
  });

  console.info(`[Predictions] ${userId} → ${matchLabel}: ${scoreA}-${scoreB}`);
  res.json({ success: true, predictionId: predId, scoreA, scoreB });
});

// GET /api/predictions/me
predictionsRouter.get('/me', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const snap = await db.collection(C.PREDICTIONS)
    .where('userId', '==', req.user!.userId)
    .get();

  const predictions = snap.docs.map(d => {
    const p = d.data();
    return {
      id: d.id,
      matchId:        p.matchId,
      scoreA:         p.scoreA,
      scoreB:         p.scoreB,
      firstGoalRange: p.firstGoalRange ?? null,
      isSafePick:     p.isSafePick ?? false,
      submittedAt:    p.submittedAt instanceof Date ? p.submittedAt.toISOString() : p.submittedAt?.toDate?.()?.toISOString(),
    };
  });

  res.json({ predictions });
});

// GET /api/predictions/:matchId/consensus
predictionsRouter.get('/:matchId/consensus', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { matchId } = req.params;

  // Read consensus counters directly from the match doc (maintained atomically on each save)
  const matchDoc = await db.collection(C.MATCHES).doc(matchId).get();
  if (!matchDoc.exists) { res.status(404).json({ error: 'MATCH_NOT_FOUND' }); return; }

  const m = matchDoc.data()!;
  const winA  = m.winACount  ?? 0;
  const draw  = m.drawCount  ?? 0;
  const winB  = m.winBCount  ?? 0;
  const total = winA + draw + winB;

  if (total === 0) {
    res.json({ winA: 33, draw: 34, winB: 33, totalVotes: 0 });
    return;
  }

  res.json({
    winA:       Math.round((winA / total) * 100),
    draw:       Math.round((draw / total) * 100),
    winB:       Math.round((winB / total) * 100),
    totalVotes: total,
  });
});
