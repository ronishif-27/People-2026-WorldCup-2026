/**
 * services/scoring.service.ts
 *
 * Scoring engine — runs after any match is marked FINISHED.
 * Fully idempotent: safe to re-run (admin override re-scores the match cleanly).
 *
 * Scoring rules (PRD §13 — single currency, coins only, no "points"):
 *   Exact score              → 100% of stage coin value
 *   Correct winner / draw    → 50%  of stage coin value
 *   Wrong outcome            → 0
 *   First-goal range correct → +25 coins (flat, additive)
 *
 * Stage coin values:
 *   GROUP_STAGE 250 | ROUND_OF_32 350 | ROUND_OF_16 450
 *   QUARTERFINALS 500 | SEMIFINALS 1000 | FINAL 2000
 *
 * First-goal bonus: football-data.org free tier does NOT return goal-by-goal
 * data, so `match.firstGoalMinute` must be set manually by an admin (via the
 * PATCH /api/matches/:id override) for the bonus to fire. If left null, the
 * bonus simply doesn't apply — exact / winner percentages still award.
 */

import { db, C, FieldValue } from '../db/firebase.js';

const STAGE_COIN_VALUE: Record<string, number> = {
  GROUP_STAGE:   250,
  ROUND_OF_32:   350,
  ROUND_OF_16:   450,
  QUARTERFINALS: 500,
  SEMIFINALS:    1000,
  FINAL:         2000,
};

const FIRST_GOAL_BONUS = 25;

function stageCoinValue(stage: string): number {
  return STAGE_COIN_VALUE[stage] ?? 250;
}

/**
 * Map a "1 - 15'" style range to its half-open numeric bounds [min, max].
 * Used to test whether match.firstGoalMinute falls inside the user's pick.
 */
function parseRange(r: string): [number, number] | null {
  const m = r.match(/(\d+)\s*-\s*(\d+)/);
  if (!m) return null;
  return [Number(m[1]), Number(m[2])];
}

function firstGoalHit(userRange: string | null, actualMinute: number | null): boolean {
  if (!userRange || actualMinute == null) return false;
  const bounds = parseRange(userRange);
  if (!bounds) return false;
  return actualMinute >= bounds[0] && actualMinute <= bounds[1];
}

/** Compute coin reward for a single prediction against the real final score. */
function computeCoins(
  predA: number,
  predB: number,
  realA: number,
  realB: number,
  stage: string,
  firstGoalRange: string | null,
  matchFirstGoalMinute: number | null,
): { coins: number; type: 'EXACT' | 'WINNER' | 'MISS' } {
  const stakeValue = stageCoinValue(stage);
  const bonus      = firstGoalHit(firstGoalRange, matchFirstGoalMinute) ? FIRST_GOAL_BONUS : 0;

  if (predA === realA && predB === realB) {
    return { coins: stakeValue + bonus, type: 'EXACT' };          // 100% + optional 25
  }

  const predWinner = predA > predB ? 'A' : predA < predB ? 'B' : 'DRAW';
  const realWinner = realA > realB ? 'A' : realA < realB ? 'B' : 'DRAW';

  if (predWinner === realWinner) {
    return { coins: Math.floor(stakeValue * 0.5) + bonus, type: 'WINNER' };   // 50% + optional 25
  }

  return { coins: 0, type: 'MISS' };
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
    // Reverse old coin deltas from affected users before deleting
    const reversal: Record<string, { coinBalance: number; exactCorrectCount: number; winnerCorrectCount: number }> = {};
    for (const doc of oldScores.docs) {
      const s = doc.data();
      const uid = s.userId as string;
      if (!reversal[uid]) reversal[uid] = { coinBalance: 0, exactCorrectCount: 0, winnerCorrectCount: 0 };
      // Read the stored coin value; fall back to legacy `points` field on old docs
      reversal[uid].coinBalance        -= (s.coins ?? s.points ?? 0) as number;
      if (s.type === 'EXACT')  reversal[uid].exactCorrectCount  -= 1;
      if (s.type === 'WINNER') reversal[uid].winnerCorrectCount -= 1;
    }

    const reversalBatch = db.batch();
    for (const doc of oldScores.docs) reversalBatch.delete(doc.ref);
    await reversalBatch.commit();

    const userReversalBatch = db.batch();
    for (const [uid, delta] of Object.entries(reversal)) {
      const userRef = db.collection(C.USERS).doc(uid);
      userReversalBatch.update(userRef, {
        coinBalance:        FieldValue.increment(delta.coinBalance),
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

  // ── 3. Compute and write new coin awards ──────────────────────────────────
  // First-goal bonus uses match.firstGoalMinute, which is set manually by an
  // admin via PATCH /api/matches/:id (football-data.org free tier doesn't
  // return goal-by-goal data). If unset, the +25 bonus simply doesn't fire —
  // exact / winner percentages still award.
  const matchFirstGoalMinute = (match.firstGoalMinute as number | null) ?? null;

  const scoreBatch  = db.batch();
  const userDeltas: Record<string, { coinBalance: number; exactCorrectCount: number; winnerCorrectCount: number }> = {};

  for (const predDoc of predsSnap.docs) {
    const p = predDoc.data();
    const { coins, type } = computeCoins(
      p.scoreA as number,
      p.scoreB as number,
      realA,
      realB,
      match.stage as string,
      (p.firstGoalRange as string | null) ?? null,
      matchFirstGoalMinute,
    );

    const scoreRef = db.collection(C.SCORES).doc(`${p.userId}_${matchId}`);
    scoreBatch.set(scoreRef, {
      userId:    p.userId,
      matchId,
      coins,
      type,
      createdAt: new Date(),
    });

    const uid = p.userId as string;
    if (!userDeltas[uid]) userDeltas[uid] = { coinBalance: 0, exactCorrectCount: 0, winnerCorrectCount: 0 };
    userDeltas[uid].coinBalance += coins;
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
  const preRank = rankUsers(allUsersBefore.docs.map(d => ({
    id:    d.id,
    coins: d.data().coinBalance ?? d.data().totalPoints ?? 0,
    exact: d.data().exactCorrectCount ?? 0,
  })));

  // ── 5. Update user coin balances ──────────────────────────────────────────
  const userBatch = db.batch();
  for (const [uid, delta] of Object.entries(userDeltas)) {
    const userRef = db.collection(C.USERS).doc(uid);
    userBatch.update(userRef, {
      coinBalance:        FieldValue.increment(delta.coinBalance),
      exactCorrectCount:  FieldValue.increment(delta.exactCorrectCount),
      winnerCorrectCount: FieldValue.increment(delta.winnerCorrectCount),
    });
  }
  await userBatch.commit();

  // ── 6. Post-rank snapshot + activity events ────────────────────────────────
  const postRank = rankUsers(allUsersBefore.docs.map(d => {
    const delta = userDeltas[d.id];
    const coins = (d.data().coinBalance ?? d.data().totalPoints ?? 0) + (delta?.coinBalance ?? 0);
    const exact = (d.data().exactCorrectCount ?? 0) + (delta?.exactCorrectCount ?? 0);
    return { id: d.id, coins, exact };
  }));

  const matchLabel = `${match.teamA} vs ${match.teamB}`;
  const now = new Date();
  const activityBatch = db.batch();

  for (const [uid, delta] of Object.entries(userDeltas)) {
    const meta = userMeta.get(uid);
    if (!meta) continue;
    // COINS_EARNED — only when the user actually scored on this match
    if (delta.coinBalance > 0) {
      const ref = db.collection(C.ACTIVITY).doc();
      activityBatch.set(ref, {
        type:       'COINS_EARNED',
        userId:     uid,
        userName:   meta.fullName,
        department: meta.department,
        site:       meta.site,
        avatarUrl:  meta.avatarUrl,
        matchId,
        matchLabel,
        coins:      delta.coinBalance,
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
 * Rank an array of {id, coins, exact} entries by coinBalance DESC then exactCount DESC.
 * Returns a Map<userId, rank> where rank starts at 1.
 */
function rankUsers(rows: Array<{ id: string; coins: number; exact: number }>): Map<string, number> {
  const sorted = rows
    .slice()
    .sort((a, b) => b.coins - a.coins || b.exact - a.exact);
  const map = new Map<string, number>();
  sorted.forEach((r, i) => map.set(r.id, i + 1));
  return map;
}
