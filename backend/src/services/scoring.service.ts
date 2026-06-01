/**
 * services/scoring.service.ts
 *
 * Scoring engine — runs after any match is marked FINISHED.
 * Fully idempotent: safe to re-run (admin override re-scores the match cleanly).
 *
 * Scoring rules (from PRD):
 *   Exact score    → +100 × stage multiplier (in coins)
 *   Correct winner → +40  × stage multiplier
 *   First-goal hit → +25  bonus (flat, not multiplied)
 *   Miss           → 0
 *
 * Stage coin multipliers:
 *   GROUP_STAGE  → 250  |  ROUND_OF_32 → 350  |  ROUND_OF_16 → 450
 *   QUARTERFINALS → 500  |  SEMIFINALS  → 1000 |  FINAL       → 2000
 */

import { db, C, FieldValue } from '../db/firebase.js';

// ─── Stage multipliers ────────────────────────────────────────────────────────

const STAGE_COINS: Record<string, number> = {
  GROUP_STAGE:   250,
  ROUND_OF_32:   350,
  ROUND_OF_16:   450,
  QUARTERFINALS: 500,
  SEMIFINALS:    1000,
  FINAL:         2000,
};

function stageMultiplier(stage: string): number {
  return STAGE_COINS[stage] ?? 250;
}

/** Points awarded for a single prediction against the real final score */
function computePoints(
  predA: number,
  predB: number,
  realA: number,
  realB: number,
  stage: string,
  firstGoalRange: string | null,
  matchFirstGoal: string | null,
): { points: number; type: 'EXACT' | 'WINNER' | 'MISS' } {
  const mult = stageMultiplier(stage);

  if (predA === realA && predB === realB) {
    // Exact score
    const bonus = firstGoalRange && firstGoalRange === matchFirstGoal ? 25 : 0;
    return { points: 100 * mult + bonus, type: 'EXACT' };
  }

  const predWinner = predA > predB ? 'A' : predA < predB ? 'B' : 'DRAW';
  const realWinner = realA > realB ? 'A' : realA < realB ? 'B' : 'DRAW';

  if (predWinner === realWinner) {
    const bonus = firstGoalRange && firstGoalRange === matchFirstGoal ? 25 : 0;
    return { points: 40 * mult + bonus, type: 'WINNER' };
  }

  return { points: 0, type: 'MISS' };
}

// ─── Main scoring function ────────────────────────────────────────────────────

/**
 * Score all predictions for a finished match.
 * Called automatically when football-data.org reports FINISHED,
 * and called again when admin overrides the score (idempotent).
 */
export async function scoreMatch(matchId: string): Promise<{ scored: number }> {
  const matchRef  = db.collection(C.MATCHES).doc(matchId);
  const matchSnap = await matchRef.get();

  if (!matchSnap.exists) {
    console.warn(`[Scoring] Match ${matchId} not found`);
    return { scored: 0 };
  }

  const match = matchSnap.data()!;
  const realA  = match.scoreA as number | null;
  const realB  = match.scoreB as number | null;

  if (realA === null || realB === null) {
    console.warn(`[Scoring] Match ${matchId} has no final score — skipping`);
    return { scored: 0 };
  }

  // ── 1. Remove old Score docs for this match (idempotent for admin re-score) ──
  const oldScores = await db.collection(C.SCORES).where('matchId', '==', matchId).get();

  if (!oldScores.empty) {
    // Reverse old points from affected users before deleting
    const reversal: Record<string, { totalPoints: number; exactCorrectCount: number; winnerCorrectCount: number }> = {};
    for (const doc of oldScores.docs) {
      const s = doc.data();
      const uid = s.userId as string;
      if (!reversal[uid]) reversal[uid] = { totalPoints: 0, exactCorrectCount: 0, winnerCorrectCount: 0 };
      reversal[uid].totalPoints        -= s.points as number;
      if (s.type === 'EXACT')  reversal[uid].exactCorrectCount  -= 1;
      if (s.type === 'WINNER') reversal[uid].winnerCorrectCount -= 1;
    }

    const reversalBatch = db.batch();
    for (const doc of oldScores.docs) reversalBatch.delete(doc.ref);
    await reversalBatch.commit();

    // Apply reversals to users
    const userReversalBatch = db.batch();
    for (const [uid, delta] of Object.entries(reversal)) {
      const userRef = db.collection(C.USERS).doc(uid);
      userReversalBatch.update(userRef, {
        totalPoints:        FieldValue.increment(delta.totalPoints),
        exactCorrectCount:  FieldValue.increment(delta.exactCorrectCount),
        winnerCorrectCount: FieldValue.increment(delta.winnerCorrectCount),
      });
    }
    await userReversalBatch.commit();
  }

  // ── 2. Fetch all predictions for this match ────────────────────────────────
  const predsSnap = await db.collection(C.PREDICTIONS).where('matchId', '==', matchId).get();

  if (predsSnap.empty) {
    console.info(`[Scoring] No predictions for match ${matchId} — nothing to score`);
    await matchRef.update({ scoredAt: new Date() });
    return { scored: 0 };
  }

  // ── 3. Compute and write new scores ───────────────────────────────────────
  const scoreBatch  = db.batch();
  const userDeltas: Record<string, { totalPoints: number; exactCorrectCount: number; winnerCorrectCount: number }> = {};

  for (const predDoc of predsSnap.docs) {
    const p = predDoc.data();
    const { points, type } = computePoints(
      p.scoreA as number,
      p.scoreB as number,
      realA,
      realB,
      match.stage as string,
      (p.firstGoalRange as string | null) ?? null,
      null, // matchFirstGoal — extend when we track actual first goal time
    );

    const scoreRef = db.collection(C.SCORES).doc(`${p.userId}_${matchId}`);
    scoreBatch.set(scoreRef, {
      userId:    p.userId,
      matchId,
      points,
      type,
      createdAt: new Date(),
    });

    const uid = p.userId as string;
    if (!userDeltas[uid]) userDeltas[uid] = { totalPoints: 0, exactCorrectCount: 0, winnerCorrectCount: 0 };
    userDeltas[uid].totalPoints += points;
    if (type === 'EXACT')  userDeltas[uid].exactCorrectCount  += 1;
    if (type === 'WINNER') userDeltas[uid].winnerCorrectCount += 1;
  }

  await scoreBatch.commit();

  // ── 4. Snapshot pre-rank for users affected by this match ─────────────────
  // We need this BEFORE applying user deltas so we can detect rank changes.
  const allUsersBefore = await db.collection(C.USERS).where('role', '==', 'USER').get();
  const userMeta = new Map<string, { fullName: string; department: string; site: string; avatarUrl: string | null }>();
  for (const d of allUsersBefore.docs) {
    const dd = d.data();
    userMeta.set(d.id, {
      fullName:   dd.fullName ?? d.id,
      department: dd.department ?? '',
      site:       dd.site ?? '',
      avatarUrl:  dd.avatarUrl ?? null,
    });
  }
  const preRank = rankUsers(allUsersBefore.docs.map(d => ({ id: d.id, points: d.data().totalPoints ?? 0, exact: d.data().exactCorrectCount ?? 0 })));

  // ── 5. Update user totals ──────────────────────────────────────────────────
  const userBatch = db.batch();
  for (const [uid, delta] of Object.entries(userDeltas)) {
    const userRef = db.collection(C.USERS).doc(uid);
    userBatch.update(userRef, {
      totalPoints:        FieldValue.increment(delta.totalPoints),
      exactCorrectCount:  FieldValue.increment(delta.exactCorrectCount),
      winnerCorrectCount: FieldValue.increment(delta.winnerCorrectCount),
    });
  }
  await userBatch.commit();

  // ── 6. Post-rank snapshot + activity events ────────────────────────────────
  const postRank = rankUsers(allUsersBefore.docs.map(d => {
    const delta = userDeltas[d.id];
    const pts   = (d.data().totalPoints ?? 0) + (delta?.totalPoints ?? 0);
    const exact = (d.data().exactCorrectCount ?? 0) + (delta?.exactCorrectCount ?? 0);
    return { id: d.id, points: pts, exact };
  }));

  const matchLabel = `${match.teamA} vs ${match.teamB}`;
  const now = new Date();
  const activityBatch = db.batch();

  for (const [uid, delta] of Object.entries(userDeltas)) {
    const meta = userMeta.get(uid);
    if (!meta) continue;
    // POINTS_EARNED — only when the user actually scored on this match
    if (delta.totalPoints > 0) {
      const ref = db.collection(C.ACTIVITY).doc();
      activityBatch.set(ref, {
        type:       'POINTS_EARNED',
        userId:     uid,
        userName:   meta.fullName,
        department: meta.department,
        site:       meta.site,
        avatarUrl:  meta.avatarUrl,
        matchId,
        matchLabel,
        points:     delta.totalPoints,
        createdAt:  now,
      });
    }
    // RANK_CHANGED — only when rank actually moved
    const before = preRank.get(uid);
    const after  = postRank.get(uid);
    if (before && after && before !== after) {
      const ref = db.collection(C.ACTIVITY).doc();
      activityBatch.set(ref, {
        type:       'RANK_CHANGED',
        userId:     uid,
        userName:   meta.fullName,
        department: meta.department,
        site:       meta.site,
        avatarUrl:  meta.avatarUrl,
        fromRank:   before,
        toRank:     after,
        direction:  after < before ? 'UP' : 'DOWN',
        createdAt:  now,
      });
    }
  }
  await activityBatch.commit();

  // ── 7. Mark match as scored ────────────────────────────────────────────────
  await matchRef.update({ scoredAt: new Date() });

  const scored = predsSnap.size;
  console.info(`[Scoring] Match ${matchId} (${match.teamA} vs ${match.teamB}) — scored ${scored} predictions`);
  return { scored };
}

/**
 * Rank an array of {id, points, exact} entries by points DESC then exact DESC.
 * Returns a Map<userId, rank> where rank starts at 1.
 */
function rankUsers(rows: Array<{ id: string; points: number; exact: number }>): Map<string, number> {
  const sorted = rows
    .slice()
    .sort((a, b) => b.points - a.points || b.exact - a.exact);
  const map = new Map<string, number>();
  sorted.forEach((r, i) => map.set(r.id, i + 1));
  return map;
}
