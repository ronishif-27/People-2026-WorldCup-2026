/**
 * services/leaderboard-cache.service.ts
 *
 * Per-Cloud-Run-instance in-memory cache for the global leaderboard.
 *
 * Why: at our target scale (~1000 employees polling /api/leaderboard every
 * 30s) every uncached request would do a full scan of wc_users — 1000 doc
 * reads × 1000 clients × 2 polls/min = ~2M Firestore reads/min, ~$1700/day
 * just for leaderboard polls. With this cache, each Cloud Run instance does
 * 1 scan per 30s regardless of client count. ~200x cost reduction.
 *
 * Semantics:
 *   - Single source of truth on each instance: an in-memory array of
 *     ranked LeaderboardEntry, sorted by coinBalance DESC then exact DESC.
 *   - Background refresh every 30s.
 *   - `invalidate()` triggers an immediate async refresh (called after every
 *     prediction save and after every scoreMatch completion). Reads in
 *     flight see the existing data; the next read after the refresh resolves
 *     sees fresh data.
 *   - Single-flight: concurrent invalidate()/refresh() calls coalesce to one
 *     Firestore scan.
 *   - Stale-while-revalidate: if the cache is older than 60s on a read, we
 *     trigger a refresh in the background but still return what we have.
 *
 * Trade-off: a client may see up to ~30s-old leaderboard data on a routine
 * poll. The user's own header stats refresh immediately via /api/auth/me
 * (which reads the user doc directly, bypassing this cache). Acceptable per
 * the spec — "real-time push is only required on the activity ticker, the
 * leaderboard can refresh on poll/visit".
 */

import { db, C } from '../db/firebase.js';

export interface LeaderboardEntry {
  rank:               number;
  userId:             string;
  fullName:           string;
  department:         string;
  site:               string;
  avatarUrl:          string | null;
  exactCorrectCount:  number;
  winnerCorrectCount: number;
  hasParticipated:    boolean;
  totalGames:         number;
  totalWins:          number;
  coinBalance:        number;
}

// ─── Module-scoped state ─────────────────────────────────────────────────────

let cached: LeaderboardEntry[] | null = null;
let lastFetchMs    = 0;
let inflight: Promise<LeaderboardEntry[]> | null = null;

const REFRESH_INTERVAL_MS = 30_000;  // background tick — matches frontend poll cadence
const STALE_TRIGGER_MS    = 60_000;  // reads older than this trigger background refresh

// Legacy fallback: pre-rewrite docs used `totalPoints` for the same field.
const coinsOf = (d: FirebaseFirestore.DocumentData) =>
  (d.coinBalance ?? d.totalPoints ?? 0) as number;

/** Pull the entire USER-role universe from Firestore and rank it. */
async function fetchAndRank(): Promise<LeaderboardEntry[]> {
  const snap = await db.collection(C.USERS)
    .where('role', '==', 'USER')
    .get();

  return snap.docs
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
        totalGames:         d.predictionCount ?? 0,
        totalWins:          exact + winner,
        coinBalance:        coinsOf(d),
      };
    });
}

/**
 * Get the cached leaderboard. Triggers a lazy refresh if the cache is empty
 * or older than STALE_TRIGGER_MS (background, doesn't block this read).
 */
export async function getLeaderboard(): Promise<LeaderboardEntry[]> {
  // Cold start: synchronously populate before returning.
  if (cached === null) {
    return refresh();
  }
  // Warm but stale: trigger background refresh, return what we have.
  if (Date.now() - lastFetchMs > STALE_TRIGGER_MS) {
    refresh().catch(err => console.warn('[LeaderboardCache] background refresh failed:', err));
  }
  return cached;
}

/**
 * Force a refresh from Firestore. Concurrent callers share a single in-flight
 * fetch (single-flight pattern). On failure, the existing cache is preserved.
 */
export async function refresh(): Promise<LeaderboardEntry[]> {
  if (inflight) return inflight;
  inflight = fetchAndRank()
    .then((rows) => {
      cached      = rows;
      lastFetchMs = Date.now();
      return rows;
    })
    .catch((err) => {
      console.error('[LeaderboardCache] fetch failed:', err);
      // If we have stale data, return it; otherwise re-throw for cold-start callers.
      if (cached) return cached;
      throw err;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

/**
 * Mark the cache stale and trigger a background refresh. Called after every
 * write that changes the leaderboard (prediction save, scoreMatch). Reads
 * in flight before the refresh completes still see the old data; reads
 * after see the new data. Safe to call from any path.
 */
export function invalidate(): void {
  // Force the next read to perceive the cache as stale even within the
  // 60s window, while a fresh fetch is launched in the background.
  lastFetchMs = 0;
  refresh().catch(() => { /* logged inside refresh() */ });
}

/**
 * Start the background tick. Call once from server.ts startup.
 * The unref() lets the process exit cleanly during tests / SIGTERM.
 */
export function startBackgroundRefresh(): NodeJS.Timeout {
  const handle = setInterval(() => {
    refresh().catch(() => { /* logged inside refresh() */ });
  }, REFRESH_INTERVAL_MS);
  handle.unref?.();
  return handle;
}
