/**
 * db/firebase.ts
 *
 * Firebase Admin SDK initialisation for Firestore.
 * Uses GOOGLE_APPLICATION_CREDENTIALS (local) or Application Default Credentials (Cloud Run).
 *
 * All collections are prefixed with `wc_` to avoid collisions with other
 * apps that may share the ai-innovation-484111 GCP project.
 */

import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getFirestore, Firestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { resolve } from 'path';

let _app: App | null = null;
let _db: Firestore | null = null;

function initFirebase(): App {
  if (getApps().length > 0) return getApps()[0];

  const credsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const projectId  = process.env.FIREBASE_PROJECT_ID ?? 'ai-innovation-484111';

  if (credsPath) {
    // Local dev: explicit service account JSON file
    const resolved = resolve(process.cwd(), credsPath);
    const serviceAccount = JSON.parse(readFileSync(resolved, 'utf-8'));
    return initializeApp({ credential: cert(serviceAccount), projectId });
  }

  // Cloud Run / GCP environment: Application Default Credentials
  return initializeApp({ projectId });
}

export function getDb(): Firestore {
  if (!_db) {
    _app = initFirebase();
    // If FIRESTORE_DATABASE_ID is set (e.g. "worldcup"), target that named
    // database explicitly. Otherwise fall back to the project's "(default)".
    const dbId = process.env.FIRESTORE_DATABASE_ID;
    _db = dbId ? getFirestore(_app, dbId) : getFirestore(_app);
  }
  return _db;
}

// Lazy proxy — safe to import at module level, initialised on first use
export const db = new Proxy({} as Firestore, {
  get(_, prop: string) {
    return (getDb() as any)[prop];
  },
});

// All Firestore collection names — prefix `wc_` isolates from other apps in the project
export const C = {
  USERS:        'wc_users',
  MATCHES:      'wc_matches',
  PREDICTIONS:  'wc_predictions',
  SCORES:       'wc_scores',
  ACTIVITY:     'wc_activity',
  TERMS:        'wc_terms_acceptances',
} as const;

export { FieldValue, Timestamp };
