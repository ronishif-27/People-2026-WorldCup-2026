/**
 * server.ts — Firestore edition
 * Express application entry point. Uses Firebase Admin SDK / Firestore.
 * No SQL database or Prisma.
 */

import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import { authRouter }        from './routes/auth.routes.js';
import { matchesRouter }     from './routes/matches.routes.js';
import { predictionsRouter } from './routes/predictions.routes.js';
import { leaderboardRouter } from './routes/leaderboard.routes.js';
import { usersRouter }       from './routes/users.routes.js';
import { activityRouter }    from './routes/activity.routes.js';
import { eventsRouter }      from './routes/events.routes.js';
import { syncMatchesFromApi, hasLiveMatches } from './services/football.service.js';
import { warmDepartmentCache } from './services/hibob.service.js';
import { startBackgroundRefresh as startLeaderboardRefresh, refresh as refreshLeaderboard } from './services/leaderboard-cache.service.js';
import { getDb } from './db/firebase.js';

const app = express();

app.use(cors({
  origin: config.FRONTEND_URL,
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: false,
}));
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: false }));

if (config.NODE_ENV === 'development') {
  app.use((req, _res, next) => { console.log(`→ ${req.method} ${req.path}`); next(); });
}

// Health check — verifies Firestore connectivity
app.get('/health', async (_req, res) => {
  try {
    await getDb().collection('_health').doc('ping').set({ ts: new Date() });
    res.json({ status: 'ok', db: 'firestore', timestamp: new Date().toISOString() });
  } catch {
    res.status(503).json({ status: 'error', message: 'Firestore unreachable' });
  }
});

app.use('/api/auth',        authRouter);
app.use('/api/matches',     matchesRouter);
app.use('/api/predictions', predictionsRouter);
app.use('/api/leaderboard', leaderboardRouter);
app.use('/api/users',       usersRouter);
app.use('/api/activity',    activityRouter);
app.use('/api/events',      eventsRouter);

app.use((_req, res) => { res.status(404).json({ error: 'NOT_FOUND' }); });

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[Server] Unhandled error:', err);
  res.status(500).json({ error: 'INTERNAL_SERVER_ERROR', message: config.NODE_ENV === 'development' ? err.message : 'An unexpected error occurred.' });
});

async function start(): Promise<void> {
  // Verify Firestore connectivity
  try {
    await getDb().collection('_health').doc('ping').set({ ts: new Date() });
    console.log('✅ Firestore connected');
  } catch (err) {
    console.error('❌ Firestore connection failed:', err);
    process.exit(1);
  }

  // Bind to 0.0.0.0 — required for Cloud Run, harmless locally
  app.listen(config.PORT, '0.0.0.0', () => {
    const dbId = process.env.FIRESTORE_DATABASE_ID ?? '(default)';
    console.log(`\n🚀 Worldcup API listening on 0.0.0.0:${config.PORT}`);
    console.log(`   Environment : ${config.NODE_ENV}`);
    console.log(`   Frontend URL: ${config.FRONTEND_URL}`);
    console.log(`   Firestore   : ${config.FIREBASE_PROJECT_ID} / ${dbId}\n`);
  });

  warmDepartmentCache().catch(e => console.warn('[HiBob] Cache warm-up failed:', e));

  // Warm the leaderboard cache and start the 30s background refresh.
  // Per-instance cache eliminates ~200x of the read amplification from
  // client polling — see services/leaderboard-cache.service.ts.
  refreshLeaderboard()
    .then(rows => console.log(`✅ Leaderboard cache warm (${rows.length} users)`))
    .catch(e => console.warn('[Leaderboard] initial warm failed:', e));
  startLeaderboardRefresh();

  await syncMatchesFromApi();

  let syncTimer: ReturnType<typeof setTimeout>;
  async function scheduleSyncJob() {
    const live    = await hasLiveMatches();
    const delayMs = live ? 2 * 60 * 1000 : 30 * 60 * 1000;
    syncTimer = setTimeout(async () => { await syncMatchesFromApi(); scheduleSyncJob(); }, delayMs);
  }
  scheduleSyncJob();

  process.on('SIGTERM', () => {
    console.log('[Server] SIGTERM — shutting down');
    clearTimeout(syncTimer);
    process.exit(0);
  });
}

start();
