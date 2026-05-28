/**
 * services/football.service.ts
 *
 * Fetches FIFA World Cup 2026 match data from football-data.org (free tier),
 * maps it to our internal schema, and upserts it into the local database.
 *
 * API docs: https://www.football-data.org/documentation/quickstart
 * Competition: WC (FIFA World Cup)  |  Base: https://api.football-data.org/v4
 * Auth: X-Auth-Token header
 * Rate limit (free): 10 req/min
 */

import axios, { AxiosError } from 'axios';
import { config } from '../config.js';
import { prisma } from '../db/prisma.js';

const BASE_URL = 'https://api.football-data.org/v4';
const COMPETITION = 'WC';

// ─── Flag emoji map ───────────────────────────────────────────────────────────
// Maps football-data.org team names → country flag emoji

const FLAG_MAP: Record<string, string> = {
  Algeria:              '🇩🇿',
  Argentina:            '🇦🇷',
  Australia:            '🇦🇺',
  Austria:              '🇦🇹',
  Belgium:              '🇧🇪',
  'Bosnia-Herzegovina': '🇧🇦',
  Brazil:               '🇧🇷',
  Canada:               '🇨🇦',
  'Cape Verde Islands': '🇨🇻',
  Colombia:             '🇨🇴',
  'Congo DR':           '🇨🇩',
  Croatia:              '🇭🇷',
  'Curaçao':            '🇨🇼',
  Czechia:              '🇨🇿',
  Ecuador:              '🇪🇨',
  Egypt:                '🇪🇬',
  England:              '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
  France:               '🇫🇷',
  Germany:              '🇩🇪',
  Ghana:                '🇬🇭',
  Haiti:                '🇭🇹',
  Iran:                 '🇮🇷',
  Iraq:                 '🇮🇶',
  'Ivory Coast':        '🇨🇮',
  Japan:                '🇯🇵',
  Jordan:               '🇯🇴',
  Mexico:               '🇲🇽',
  Morocco:              '🇲🇦',
  Netherlands:          '🇳🇱',
  'New Zealand':        '🇳🇿',
  Norway:               '🇳🇴',
  Panama:               '🇵🇦',
  Paraguay:             '🇵🇾',
  Portugal:             '🇵🇹',
  Qatar:                '🇶🇦',
  'Saudi Arabia':       '🇸🇦',
  Scotland:             '🏴󠁧󠁢󠁳󠁣󠁴󠁿',
  Senegal:              '🇸🇳',
  'South Africa':       '🇿🇦',
  'South Korea':        '🇰🇷',
  Spain:                '🇪🇸',
  Sweden:               '🇸🇪',
  Switzerland:          '🇨🇭',
  Tunisia:              '🇹🇳',
  Turkey:               '🇹🇷',
  'United States':      '🇺🇸',
  Uruguay:              '🇺🇾',
  Uzbekistan:           '🇺🇿',
};

function getFlag(teamName: string): string {
  return FLAG_MAP[teamName] ?? '🏳️';
}

// ─── Status mapping ───────────────────────────────────────────────────────────
// football-data.org → our DB status strings

function mapStatus(apiStatus: string): string {
  const map: Record<string, string> = {
    TIMED:     'UPCOMING',
    SCHEDULED: 'UPCOMING',
    IN_PLAY:   'LIVE',
    PAUSED:    'LIVE',    // half-time break — still "live" for display purposes
    FINISHED:  'FINISHED',
    SUSPENDED: 'UPCOMING',
    POSTPONED: 'UPCOMING',
    CANCELLED: 'UPCOMING',
  };
  return map[apiStatus] ?? 'UPCOMING';
}

// ─── Stage mapping ────────────────────────────────────────────────────────────

function mapStage(apiStage: string): string {
  const map: Record<string, string> = {
    GROUP_STAGE:   'GROUP_STAGE',
    LAST_32:       'ROUND_OF_32',
    LAST_16:       'ROUND_OF_16',
    QUARTER_FINALS:'QUARTERFINALS',
    SEMI_FINALS:   'SEMIFINALS',
    THIRD_PLACE:   'FINAL',        // 3rd-place playoff — closest mapping
    FINAL:         'FINAL',
  };
  return map[apiStage] ?? 'GROUP_STAGE';
}

// ─── Date formatter ───────────────────────────────────────────────────────────

/** Converts "GROUP_A" → "Group A", null/undefined → "" */
function formatGroup(group: string | null | undefined): string {
  if (!group) return '';
  if (group.startsWith('GROUP_')) return `Group ${group.replace('GROUP_', '')}`;
  // Already formatted
  return group.charAt(0).toUpperCase() + group.slice(1).toLowerCase().replace(/_/g, ' ');
}

function formatMatchDate(utcDate: string): string {
  const d = new Date(utcDate);
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }); // e.g. "Thu, Jun 11"
}

// ─── football-data.org API types ─────────────────────────────────────────────

interface FdTeam {
  id: number | null;
  name: string | null;
  shortName: string | null;
  tla: string | null;
  crest: string | null;
}

interface FdScore {
  winner: string | null;
  fullTime: { home: number | null; away: number | null };
  halfTime: { home: number | null; away: number | null };
}

interface FdMatch {
  id: number;
  utcDate: string;
  status: string;
  matchday: number | null;
  stage: string;
  group: string | null;
  homeTeam: FdTeam;
  awayTeam: FdTeam;
  score: FdScore;
  minute?: number | null;
}

// ─── Main sync function ───────────────────────────────────────────────────────

/**
 * Fetches all WC 2026 matches from football-data.org and upserts them
 * into the local `matches` table.  Safe to call repeatedly — fully idempotent.
 *
 * Returns { synced, errors } counts.
 */
export async function syncMatchesFromApi(): Promise<{ synced: number; errors: number }> {
  if (!config.FOOTBALL_DATA_API_KEY) {
    console.warn('[Football] FOOTBALL_DATA_API_KEY not set — skipping sync');
    return { synced: 0, errors: 0 };
  }

  let rawMatches: FdMatch[] = [];

  try {
    const res = await axios.get<{ matches: FdMatch[] }>(
      `${BASE_URL}/competitions/${COMPETITION}/matches`,
      {
        headers: { 'X-Auth-Token': config.FOOTBALL_DATA_API_KEY },
        timeout: 10_000,
      }
    );
    rawMatches = res.data.matches ?? [];
  } catch (err) {
    const axErr = err as AxiosError;
    console.error(
      '[Football] Failed to fetch matches:',
      axErr.response?.status ?? axErr.message
    );
    return { synced: 0, errors: 1 };
  }

  let synced = 0;
  let errors = 0;

  for (const m of rawMatches) {
    // Skip matches with missing team data (TBD knockout slots are null)
    if (!m.homeTeam?.name || !m.awayTeam?.name) continue;

    try {
      await prisma.match.upsert({
        where: { externalId: String(m.id) },
        create: {
          externalId: String(m.id),
          teamA:     m.homeTeam.name,
          teamB:     m.awayTeam.name,
          flagA:     getFlag(m.homeTeam.name),
          flagB:     getFlag(m.awayTeam.name),
          kickoffAt: new Date(m.utcDate),
          venue:     formatGroup(m.group),
          city:      '',
          stage:     mapStage(m.stage),
          status:    mapStatus(m.status),
          scoreA:    m.score.fullTime.home,
          scoreB:    m.score.fullTime.away,
          minute:    m.minute != null ? `${m.minute}'` : null,
        },
        update: {
          // Refresh mutable fields on every sync
          teamA:     m.homeTeam.name,
          teamB:     m.awayTeam.name,
          flagA:     getFlag(m.homeTeam.name),
          flagB:     getFlag(m.awayTeam.name),
          kickoffAt: new Date(m.utcDate),
          venue:     formatGroup(m.group),
          city:      '',
          stage:     mapStage(m.stage),
          status:    mapStatus(m.status),
          scoreA:    m.score.fullTime.home,
          scoreB:    m.score.fullTime.away,
          minute:    m.minute != null ? `${m.minute}'` : null,
        },
      });
      synced++;
    } catch (e) {
      console.error(`[Football] Failed to upsert match ${m.id}:`, e);
      errors++;
    }
  }

  console.info(`[Football] Sync complete — ${synced} upserted, ${errors} errors`);
  return { synced, errors };
}

// ─── DB query helpers ─────────────────────────────────────────────────────────

/** Shape returned to the frontend for every match */
export interface MatchResponse {
  id: string;
  externalId: string | null;
  teamA: string;
  teamB: string;
  flagA: string;
  flagB: string;
  date: string;        // human-readable e.g. "Thu, Jun 11"
  kickoffAt: string;   // ISO 8601 UTC — used for countdown / lock logic
  venue: string;
  city: string;
  stage: string;
  status: string;
  scoreA: number | null;
  scoreB: number | null;
  minute: string | null;
}

function toMatchResponse(m: {
  id: string; externalId: string | null; teamA: string; teamB: string;
  flagA: string; flagB: string; kickoffAt: Date; venue: string; city: string;
  stage: string; status: string; scoreA: number | null; scoreB: number | null;
  minute: string | null;
}): MatchResponse {
  return {
    ...m,
    date: formatMatchDate(m.kickoffAt.toISOString()),
    kickoffAt: m.kickoffAt.toISOString(),
  };
}

/** All matches, ordered by kick-off time */
export async function getAllMatches(): Promise<MatchResponse[]> {
  const matches = await prisma.match.findMany({
    orderBy: { kickoffAt: 'asc' },
    select: {
      id: true, externalId: true,
      teamA: true, teamB: true, flagA: true, flagB: true,
      kickoffAt: true, venue: true, city: true,
      stage: true, status: true,
      scoreA: true, scoreB: true, minute: true,
    },
  });
  return matches.map(toMatchResponse);
}

/** Only matches currently LIVE */
export async function getLiveMatches(): Promise<MatchResponse[]> {
  const matches = await prisma.match.findMany({
    where: { status: 'LIVE' },
    orderBy: { kickoffAt: 'asc' },
    select: {
      id: true, externalId: true,
      teamA: true, teamB: true, flagA: true, flagB: true,
      kickoffAt: true, venue: true, city: true,
      stage: true, status: true,
      scoreA: true, scoreB: true, minute: true,
    },
  });
  return matches.map(toMatchResponse);
}

/** Returns true when at least one match is currently LIVE (for polling cadence) */
export async function hasLiveMatches(): Promise<boolean> {
  const count = await prisma.match.count({ where: { status: 'LIVE' } });
  return count > 0;
}
