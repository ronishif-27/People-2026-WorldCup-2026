/**
 * services/football.service.ts — Firestore edition
 *
 * Fetches FIFA World Cup 2026 match data from football-data.org (free tier),
 * maps it to our internal schema, and upserts it into Firestore.
 * Detects FINISHED transitions and triggers the scoring engine automatically.
 *
 * API docs: https://www.football-data.org/documentation/quickstart
 * Competition: WC  |  Base: https://api.football-data.org/v4
 * Auth: X-Auth-Token header  |  Rate limit (free): 10 req/min
 */

import axios, { AxiosError } from 'axios';
import { config } from '../config.js';
import { db, C } from '../db/firebase.js';
import { scoreMatch } from './scoring.service.js';

const BASE_URL    = 'https://api.football-data.org/v4';
const COMPETITION = 'WC';

// ─── Flag emoji map ───────────────────────────────────────────────────────────

const FLAG_MAP: Record<string, string> = {
  Algeria: '🇩🇿', Argentina: '🇦🇷', Australia: '🇦🇺', Austria: '🇦🇹',
  Belgium: '🇧🇪', 'Bosnia-Herzegovina': '🇧🇦', Brazil: '🇧🇷', Canada: '🇨🇦',
  'Cape Verde Islands': '🇨🇻', Colombia: '🇨🇴', 'Congo DR': '🇨🇩', Croatia: '🇭🇷',
  'Curaçao': '🇨🇼', Czechia: '🇨🇿', Ecuador: '🇪🇨', Egypt: '🇪🇬',
  England: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', France: '🇫🇷', Germany: '🇩🇪', Ghana: '🇬🇭',
  Haiti: '🇭🇹', Iran: '🇮🇷', Iraq: '🇮🇶', 'Ivory Coast': '🇨🇮',
  Japan: '🇯🇵', Jordan: '🇯🇴', Mexico: '🇲🇽', Morocco: '🇲🇦',
  Netherlands: '🇳🇱', 'New Zealand': '🇳🇿', Norway: '🇳🇴', Panama: '🇵🇦',
  Paraguay: '🇵🇾', Portugal: '🇵🇹', Qatar: '🇶🇦', 'Saudi Arabia': '🇸🇦',
  Scotland: '🏴󠁧󠁢󠁳󠁣󠁴󠁿', Senegal: '🇸🇳', 'South Africa': '🇿🇦', 'South Korea': '🇰🇷',
  Spain: '🇪🇸', Sweden: '🇸🇪', Switzerland: '🇨🇭', Tunisia: '🇹🇳',
  Turkey: '🇹🇷', 'United States': '🇺🇸', Uruguay: '🇺🇾', Uzbekistan: '🇺🇿',
};

function getFlag(name: string): string { return FLAG_MAP[name] ?? '🏳️'; }

function mapStatus(s: string): string {
  const m: Record<string, string> = {
    TIMED: 'UPCOMING', SCHEDULED: 'UPCOMING', SUSPENDED: 'UPCOMING',
    POSTPONED: 'UPCOMING', CANCELLED: 'UPCOMING',
    IN_PLAY: 'LIVE', PAUSED: 'LIVE',
    FINISHED: 'FINISHED',
  };
  return m[s] ?? 'UPCOMING';
}

function mapStage(s: string): string {
  const m: Record<string, string> = {
    GROUP_STAGE: 'GROUP_STAGE', LAST_32: 'ROUND_OF_32', LAST_16: 'ROUND_OF_16',
    QUARTER_FINALS: 'QUARTERFINALS', SEMI_FINALS: 'SEMIFINALS',
    THIRD_PLACE: 'FINAL', FINAL: 'FINAL',
  };
  return m[s] ?? 'GROUP_STAGE';
}

function formatGroup(group: string | null | undefined): string {
  if (!group) return '';
  if (group.startsWith('GROUP_')) return `Group ${group.replace('GROUP_', '')}`;
  return group.charAt(0).toUpperCase() + group.slice(1).toLowerCase().replace(/_/g, ' ');
}

function formatMatchDate(utcDate: string): string {
  return new Date(utcDate).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC',
  });
}

interface FdTeam  { name: string | null; }
interface FdScore { fullTime: { home: number | null; away: number | null }; }
interface FdSeason { id: number; startDate: string; endDate: string; }
interface FdMatch {
  id: number; utcDate: string; status: string; stage: string;
  group: string | null; homeTeam: FdTeam; awayTeam: FdTeam;
  score: FdScore; minute?: number | null;
  season?: FdSeason;
}

// ─── Season guard ─────────────────────────────────────────────────────────────
// football-data.org's WC competition is shared across editions. We want ONLY
// World Cup 2026 data — anything else (older season retrieved by accident,
// future tournament, etc.) is rejected so we never overwrite our DB with
// non-2026 matches.
const WC_2026_SEASON_ID    = 2398;        // unique season ID per the API
const WC_2026_YEAR_PREFIX  = '2026';      // utcDate / startDate must start with this

function isWorldCup2026(m: FdMatch): boolean {
  if (m.season?.id === WC_2026_SEASON_ID) return true;
  if (m.season?.startDate?.startsWith(WC_2026_YEAR_PREFIX)) return true;
  return m.utcDate?.startsWith(WC_2026_YEAR_PREFIX) ?? false;
}

// ─── Main sync ────────────────────────────────────────────────────────────────

/**
 * Fetch the raw upstream football-data.org payload for /competitions/WC/matches.
 * Used by the admin /api/matches/debug/upstream endpoint to inspect indicators
 * (season ID, stage distribution, status distribution, year distribution).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function fetchRawUpstreamPayload(): Promise<any> {
  if (!config.FOOTBALL_DATA_API_KEY) {
    throw new Error('FOOTBALL_DATA_API_KEY not set');
  }
  const res = await axios.get(
    `${BASE_URL}/competitions/${COMPETITION}/matches`,
    { headers: { 'X-Auth-Token': config.FOOTBALL_DATA_API_KEY }, timeout: 10_000 }
  );
  return res.data;
}

export async function syncMatchesFromApi(): Promise<{ synced: number; errors: number }> {
  if (!config.FOOTBALL_DATA_API_KEY) {
    console.warn('[Football] FOOTBALL_DATA_API_KEY not set — skipping sync');
    return { synced: 0, errors: 0 };
  }

  let rawMatches: FdMatch[] = [];
  try {
    const res = await axios.get<{ matches: FdMatch[] }>(
      `${BASE_URL}/competitions/${COMPETITION}/matches`,
      { headers: { 'X-Auth-Token': config.FOOTBALL_DATA_API_KEY }, timeout: 10_000 }
    );
    rawMatches = res.data.matches ?? [];
  } catch (err) {
    console.error('[Football] Failed to fetch:', (err as AxiosError).response?.status ?? (err as AxiosError).message);
    return { synced: 0, errors: 1 };
  }

  // Hard-filter to WC 2026 only — if the API ever hands us a different season,
  // we drop those rows and log it instead of writing them to Firestore.
  const before = rawMatches.length;
  const filtered = rawMatches.filter(isWorldCup2026);
  const dropped  = before - filtered.length;
  if (dropped > 0) {
    console.warn(`[Football] Dropped ${dropped}/${before} matches — not WC 2026 season`);
  }

  let synced = 0, errors = 0, skipped = 0;

  for (const m of filtered) {
    // Knockout bracket positions before teams are determined have null names —
    // skip until the API fills them in.
    if (!m.homeTeam?.name || !m.awayTeam?.name) { skipped++; continue; }

    const docId     = String(m.id);
    const matchRef  = db.collection(C.MATCHES).doc(docId);
    const newStatus = mapStatus(m.status);

    try {
      const existing    = await matchRef.get();
      const prevStatus  = existing.exists ? (existing.data()!.status as string) : null;
      const prevScored  = existing.exists ? existing.data()!.scoredAt : null;

      await matchRef.set({
        externalId: docId,
        teamA:      m.homeTeam.name,
        teamB:      m.awayTeam.name,
        flagA:      getFlag(m.homeTeam.name),
        flagB:      getFlag(m.awayTeam.name),
        kickoffAt:  new Date(m.utcDate),
        date:       formatMatchDate(m.utcDate),
        venue:      formatGroup(m.group),
        city:       '',
        stage:      mapStage(m.stage),
        status:     newStatus,
        scoreA:     m.score.fullTime.home,
        scoreB:     m.score.fullTime.away,
        minute:     m.minute != null ? `${m.minute}'` : null,
      }, { merge: true }); // merge preserves winACount / drawCount / winBCount

      synced++;

      if (newStatus === 'FINISHED' && prevStatus !== 'FINISHED' && !prevScored) {
        console.info(`[Football] Match ${docId} finished — triggering scoring`);
        scoreMatch(docId).catch(e => console.error(`[Scoring] Match ${docId}:`, e));
      }
    } catch (e) {
      console.error(`[Football] Failed to upsert match ${m.id}:`, e);
      errors++;
    }
  }

  console.info(`[Football] Sync complete — ${synced} upserted (${skipped} TBD bracket positions skipped), ${errors} errors`);
  return { synced, errors };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export interface MatchResponse {
  id: string; externalId: string; teamA: string; teamB: string;
  flagA: string; flagB: string; date: string; kickoffAt: string;
  venue: string; city: string; stage: string; status: string;
  scoreA: number | null; scoreB: number | null; minute: string | null;
  winACount: number; drawCount: number; winBCount: number;
}

function toMatchResponse(data: FirebaseFirestore.DocumentData, id: string): MatchResponse {
  const raw = data.kickoffAt;
  const kickoffAt = raw instanceof Date ? raw.toISOString()
    : (raw?.toDate ? raw.toDate().toISOString() : String(raw));
  return {
    id, externalId: data.externalId ?? id,
    teamA: data.teamA, teamB: data.teamB, flagA: data.flagA, flagB: data.flagB,
    date: data.date ?? formatMatchDate(kickoffAt), kickoffAt,
    venue: data.venue ?? '', city: data.city ?? '',
    stage: data.stage, status: data.status,
    scoreA: data.scoreA ?? null, scoreB: data.scoreB ?? null,
    minute: data.minute ?? null,
    winACount: data.winACount ?? 0, drawCount: data.drawCount ?? 0, winBCount: data.winBCount ?? 0,
  };
}

export async function getAllMatches(): Promise<MatchResponse[]> {
  const snap = await db.collection(C.MATCHES).orderBy('kickoffAt', 'asc').get();
  return snap.docs.filter(d => d.data().teamA && d.data().teamB).map(d => toMatchResponse(d.data(), d.id));
}

export async function getLiveMatches(): Promise<MatchResponse[]> {
  // Sort in JS to avoid requiring a composite (status, kickoffAt) index — N is tiny
  const snap = await db.collection(C.MATCHES).where('status', '==', 'LIVE').get();
  return snap.docs
    .slice()
    .sort((a, b) => {
      const aT = a.data().kickoffAt?.toMillis?.() ?? 0;
      const bT = b.data().kickoffAt?.toMillis?.() ?? 0;
      return aT - bT;
    })
    .map(d => toMatchResponse(d.data(), d.id));
}

export async function hasLiveMatches(): Promise<boolean> {
  const snap = await db.collection(C.MATCHES).where('status', '==', 'LIVE').limit(1).get();
  return !snap.empty;
}

export async function getMatchById(matchId: string): Promise<MatchResponse | null> {
  const doc = await db.collection(C.MATCHES).doc(matchId).get();
  if (!doc.exists) return null;
  return toMatchResponse(doc.data()!, doc.id);
}
