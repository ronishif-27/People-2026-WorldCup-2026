/**
 * services/hibob.service.ts
 *
 * Queries the HiBob People Search API to fetch an employee's
 * Department and Site (office location) using their work email.
 *
 * Endpoint: POST https://api.hibob.com/v1/people/search
 * Auth:     Basic {base64(serviceUserId:serviceUserToken)}
 *
 * Findings from live Guesty HiBob integration:
 *  - Filter must use fieldPath: 'root.email' (not 'work.email' or 'email')
 *  - work.department returns a numeric ID (e.g. "265590516"), not a name
 *  - work.site returns the site name directly (e.g. "Israel")
 *  - fullName is not accessible to this service user — falls back to Google name
 *
 * Department IDs are resolved via GET /v1/company/named-lists/department,
 * cached in memory with a 1-hour TTL so we don't hammer the API on every login.
 *
 * Called during Google OAuth callback — non-blocking, login succeeds even if
 * HiBob is down (department/site fall back to "Unknown").
 */

import axios, { AxiosError } from 'axios';
import { config } from '../config.js';

const HIBOB_BASE_URL = 'https://api.hibob.com/v1';

/** Result returned after a successful HiBob lookup */
export interface HiBobEmployeeData {
  department: string;
  site: string;
  /** Always null for this service user — caller uses Google name as fallback */
  fullName: string | null;
  /** Signed Cloudinary URL valid ~2 months; refreshed on every login */
  avatarUrl: string | null;
}

// ─── Auth header ──────────────────────────────────────────────────────────────

function buildAuthHeader(): string {
  const credentials = `${config.HIBOB_SERVICE_USER_ID}:${config.HIBOB_SERVICE_USER_TOKEN}`;
  return `Basic ${Buffer.from(credentials).toString('base64')}`;
}

// ─── Department ID resolution cache ──────────────────────────────────────────
// HiBob stores department as a numeric ID in the work object.
// We resolve it once via the named-lists endpoint and cache it for 1 hour.

let deptMapCache: Map<string, string> | null = null;
let deptMapLoadedAt = 0;
const DEPT_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

/**
 * Fetches the full department ID→name map from HiBob and caches it.
 * Re-fetches after 1 hour. Returns an empty map on failure (graceful degradation).
 */
async function getDepartmentMap(): Promise<Map<string, string>> {
  const now = Date.now();
  if (deptMapCache && now - deptMapLoadedAt < DEPT_CACHE_TTL_MS) {
    return deptMapCache;
  }

  try {
    const res = await axios.get<{ values?: HiBobNamedListEntry[] }>(
      `${HIBOB_BASE_URL}/company/named-lists/department`,
      {
        headers: { Authorization: buildAuthHeader(), Accept: 'application/json' },
        timeout: 5_000,
      }
    );

    const map = new Map<string, string>();
    for (const entry of res.data?.values ?? []) {
      if (entry.id && entry.name) {
        map.set(String(entry.id), entry.name);
      }
    }

    deptMapCache = map;
    deptMapLoadedAt = now;
    console.info(`[HiBob] Department map loaded: ${map.size} entries`);
    return map;
  } catch (err) {
    console.error('[HiBob] Failed to load department map:', (err as AxiosError).message ?? err);
    return deptMapCache ?? new Map(); // return stale cache if available
  }
}

/**
 * Resolves a HiBob department ID or name to a human-readable name.
 * If the value is already a string name (not numeric), returns it directly.
 */
async function resolveDepartmentName(rawDept: string): Promise<string> {
  // If it looks like a numeric ID, resolve via named list
  if (/^\d+$/.test(rawDept)) {
    const map = await getDepartmentMap();
    return map.get(rawDept) ?? rawDept; // fall back to raw ID if not found (shouldn't happen)
  }
  // Already a string name — return as-is
  return rawDept;
}

// ─── Main lookup ──────────────────────────────────────────────────────────────

/**
 * Searches HiBob for an employee by their work email address.
 *
 * Returns `null` when:
 *  - No employee found with that email
 *  - HiBob API is unreachable or returns an error
 *
 * The caller MUST handle null gracefully (fall back to Google profile / defaults).
 */
export async function getEmployeeByEmail(
  email: string
): Promise<HiBobEmployeeData | null> {
  try {
    const response = await axios.post<{ employees: HiBobEmployee[] }>(
      `${HIBOB_BASE_URL}/people/search`,
      {
        fields: ['work.department', 'work.site', 'about.avatar'],
        filters: [
          {
            // Only root.id and root.email are supported as filter paths in HiBob
            fieldPath: 'root.email',
            operator: 'equals',
            values: [email.toLowerCase().trim()],
          },
        ],
      },
      {
        headers: {
          Authorization: buildAuthHeader(),
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        timeout: 5_000,
      }
    );

    const employees = response.data?.employees ?? [];

    if (employees.length === 0) {
      console.warn(`[HiBob] No employee found for email: ${email}`);
      return null;
    }

    const employee = employees[0];
    const rawDept   = employee.work?.department ?? null;
    const site      = employee.work?.site ?? null;
    const avatarUrl = employee.about?.avatar ?? null;

    // Resolve department ID → human-readable name
    const department = rawDept ? await resolveDepartmentName(rawDept) : null;

    console.info(
      `[HiBob] Employee found: ${email} | dept="${department ?? 'null'}" (raw: "${rawDept}") | site="${site ?? 'null'}" | avatar=${avatarUrl ? 'yes' : 'no'}`
    );

    return {
      department: department || 'Unknown',
      site:       site       || 'Unknown',
      fullName:   null, // service user has no access to personal fields; use Google name instead
      avatarUrl,
    };
  } catch (err) {
    const axiosErr = err as AxiosError;

    if (axiosErr.response) {
      console.error(
        `[HiBob] API error ${axiosErr.response.status} for email ${email}:`,
        axiosErr.response.data
      );
    } else if (axiosErr.code === 'ECONNABORTED') {
      console.error(`[HiBob] Request timed out for email: ${email}`);
    } else {
      console.error(`[HiBob] Unexpected error for email ${email}:`, err);
    }

    return null; // non-blocking: login still completes with defaults
  }
}

/**
 * Warms up the department name cache on server startup so the first login
 * doesn't incur the named-lists API call latency.
 */
export async function warmDepartmentCache(): Promise<void> {
  await getDepartmentMap();
}

// ─── Named-list helpers (departments + sites for onboarding dropdowns) ────────

/** Generic cache entry: list name → { values, loadedAt } */
const namedListCache = new Map<string, { values: string[]; loadedAt: number }>();

/**
 * Fetches a HiBob named list and returns the sorted, non-archived names.
 * Results are cached for 1 hour.
 */
async function getActiveNamedList(listName: string): Promise<string[]> {
  const cached = namedListCache.get(listName);
  if (cached && Date.now() - cached.loadedAt < DEPT_CACHE_TTL_MS) {
    return cached.values;
  }

  try {
    const res = await axios.get<{ values?: HiBobNamedListEntry[] }>(
      `${HIBOB_BASE_URL}/company/named-lists/${listName}`,
      {
        headers: { Authorization: buildAuthHeader(), Accept: 'application/json' },
        timeout: 5_000,
      }
    );

    const values = (res.data?.values ?? [])
      .filter((e) => !e.archived && e.name)
      .map((e) => e.name)
      .sort();

    namedListCache.set(listName, { values, loadedAt: Date.now() });
    return values;
  } catch (err) {
    console.error(`[HiBob] Failed to load named list "${listName}":`, (err as AxiosError).message);
    return cached?.values ?? []; // stale or empty
  }
}

/** Returns the live list of active HiBob department names (cached 1 h). */
export async function getHiBobDepartments(): Promise<string[]> {
  return getActiveNamedList('department');
}

/** Returns the live list of active HiBob site names (cached 1 h). */
export async function getHiBobSites(): Promise<string[]> {
  return getActiveNamedList('site');
}

// ─── Internal Types ───────────────────────────────────────────────────────────

interface HiBobEmployee {
  id?: string;
  work?: {
    department?: string;
    site?: string;
  };
  about?: {
    /** Signed Cloudinary URL — query token expires ~2 months out */
    avatar?: string;
  };
}

interface HiBobNamedListEntry {
  id: string | number;
  name: string;
  value?: string;
  archived?: boolean;
}
