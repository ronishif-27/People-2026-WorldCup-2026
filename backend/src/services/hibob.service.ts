/**
 * services/hibob.service.ts
 *
 * Queries the HiBob People Search API to fetch an employee's
 * Department and Site (office location) using their work email.
 *
 * Endpoint: POST https://api.hibob.com/v1/people/search
 * Auth:     Basic {base64(serviceUserId:serviceUserToken)}
 *
 * Called during Google OAuth callback so department + site are
 * always fresh from the source of truth (HiBob) on every login.
 */

import axios, { AxiosError } from 'axios';
import { config } from '../config.js';

const HIBOB_BASE_URL = 'https://api.hibob.com/v1';

/** Result returned after a successful HiBob lookup */
export interface HiBobEmployeeData {
  department: string;
  site: string;
  fullName: string;
}

/**
 * Build the Basic Auth header value from the HiBob service user credentials.
 * HiBob service users authenticate with:  serviceUserId:serviceUserToken
 */
function buildAuthHeader(): string {
  const credentials = `${config.HIBOB_SERVICE_USER_ID}:${config.HIBOB_SERVICE_USER_TOKEN}`;
  const encoded = Buffer.from(credentials).toString('base64');
  return `Basic ${encoded}`;
}

/**
 * Searches HiBob for an employee by their work email address.
 *
 * Returns `null` when:
 *  - No employee found with that email (user may not be in HiBob yet)
 *  - HiBob API is unreachable
 *
 * The caller must handle null gracefully (fall back to Google profile / defaults).
 */
export async function getEmployeeByEmail(
  email: string
): Promise<HiBobEmployeeData | null> {
  try {
    const response = await axios.post(
      `${HIBOB_BASE_URL}/people/search`,
      {
        // Request only the fields we need — minimises response payload
        fields: [
          'fullName',
          'work.department',
          'work.site',
        ],
        filters: [
          {
            fieldName: 'email',
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
        // Fail fast — OAuth flow should not hang waiting for HiBob
        timeout: 5_000,
      }
    );

    const employees: HiBobEmployee[] = response.data?.employees ?? [];

    if (employees.length === 0) {
      console.warn(`[HiBob] No employee found for email: ${email}`);
      return null;
    }

    const employee = employees[0];

    // HiBob nested work object — both paths guarded against undefined
    const department = employee.work?.department ?? employee.department ?? null;
    const site = employee.work?.site ?? employee.site ?? null;
    const fullName = employee.fullName ?? null;

    if (!department && !site) {
      console.warn(
        `[HiBob] Employee found for ${email} but department/site fields are empty. ` +
          'Check that the service user has read access to Work fields.'
      );
    }

    return {
      department: department || 'Unknown',
      site: site || 'Unknown',
      fullName: fullName || email.split('@')[0],
    };
  } catch (err) {
    const axiosErr = err as AxiosError;

    if (axiosErr.response) {
      // HiBob returned a non-2xx response
      console.error(
        `[HiBob] API error ${axiosErr.response.status} for email ${email}:`,
        axiosErr.response.data
      );
    } else if (axiosErr.code === 'ECONNABORTED') {
      console.error(`[HiBob] Request timed out for email: ${email}`);
    } else {
      console.error(`[HiBob] Unexpected error for email ${email}:`, err);
    }

    // Non-blocking: return null so login can still proceed with defaults
    return null;
  }
}

// ─── Internal Types ───────────────────────────────────────────────────────────

/** Shape of a single employee record from HiBob API response */
interface HiBobEmployee {
  id?: string;
  fullName?: string;
  email?: string;
  // HiBob nests work data under `work`
  work?: {
    department?: string;
    site?: string;
    email?: string;
  };
  // Some HiBob configurations expose these at the top level
  department?: string;
  site?: string;
}
