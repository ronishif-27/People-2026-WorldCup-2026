/**
 * server.ts
 * Express application entry point.
 *
 * Starts the HTTP server and registers all routes and middleware.
 * All routes are prefixed with /api to allow the frontend and API
 * to be served from the same Cloud Run service (or behind the same
 * API gateway).
 */

import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import { authRouter } from './routes/auth.routes.js';
import { matchesRouter } from './routes/matches.routes.js';
import { syncMatchesFromApi, hasLiveMatches } from './services/football.service.js';
import { warmDepartmentCache } from './services/hibob.service.js';
import { prisma } from './db/prisma.js';

const app = express();

// ─── Core Middleware ──────────────────────────────────────────────────────────

/**
 * CORS — allow the frontend origin.
 * In development: http://localhost:3000
 * In production:  https://worldcup.guesty.com (or Firebase Hosting URL)
 */
app.use(
  cors({
    origin: config.FRONTEND_URL,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: false, // We use Bearer tokens, not cookies
  })
);

/** Parse JSON request bodies */
app.use(express.json({ limit: '10kb' }));

/** Parse URL-encoded bodies (needed for some form submissions) */
app.use(express.urlencoded({ extended: false }));

// ─── Request Logger (dev only) ────────────────────────────────────────────────

if (config.NODE_ENV === 'development') {
  app.use((req, _res, next) => {
    console.log(`→ ${req.method} ${req.path}`);
    next();
  });
}

// ─── Health Check ─────────────────────────────────────────────────────────────

/**
 * GET /health
 * Used by Cloud Run's liveness probe.
 * Also checks DB connectivity so the probe fails if Postgres is down.
 */
app.get('/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  } catch {
    res.status(503).json({ status: 'error', message: 'Database unreachable' });
  }
});

// ─── API Routes ───────────────────────────────────────────────────────────────

/** Auth routes: /api/auth/google, /api/auth/callback, /api/auth/me, /api/auth/logout */
app.use('/api/auth', authRouter);

/** Match routes: /api/matches, /api/matches/live, /api/matches/sync */
app.use('/api/matches', matchesRouter);

// Placeholders — built in later phases:
// app.use('/api/predictions', predictionsRouter);
// app.use('/api/leaderboard', leaderboardRouter);

// ─── 404 Handler ─────────────────────────────────────────────────────────────

app.use((_req, res) => {
  res.status(404).json({
    error: 'NOT_FOUND',
    message: 'The requested endpoint does not exist.',
  });
});

// ─── Global Error Handler ─────────────────────────────────────────────────────

app.use(
  (
    err: Error,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    console.error('[Server] Unhandled error:', err);
    res.status(500).json({
      error: 'INTERNAL_SERVER_ERROR',
      message:
        config.NODE_ENV === 'development'
          ? err.message
          : 'An unexpected error occurred.',
    });
  }
);

// ─── Start ────────────────────────────────────────────────────────────────────

async function start(): Promise<void> {
  // Verify DB connection before accepting traffic
  try {
    await prisma.$connect();
    console.log('✅ Database connected');
  } catch (err) {
    console.error('❌ Database connection failed:', err);
    process.exit(1);
  }

  app.listen(config.PORT, () => {
    console.log(`\n🚀 Worldcup API running at http://localhost:${config.PORT}`);
    console.log(`   Environment : ${config.NODE_ENV}`);
    console.log(`   Frontend URL: ${config.FRONTEND_URL}`);
    console.log(`   Auth URL    : http://localhost:${config.PORT}/api/auth/google\n`);
  });

  // ── HiBob department cache warm-up ────────────────────────────────────────
  // Pre-loads the department ID→name map so the first login has no extra latency.
  warmDepartmentCache().catch((e) => console.warn('[HiBob] Cache warm-up failed:', e));

  // ── Football data sync ────────────────────────────────────────────────────
  // Sync once at startup so the DB has fresh data immediately.
  // Then poll: every 2 min when live matches are on, every 30 min otherwise.
  await syncMatchesFromApi();

  let syncTimer: ReturnType<typeof setTimeout>;

  async function scheduleSyncJob() {
    const live = await hasLiveMatches();
    const delayMs = live
      ? 2 * 60 * 1000   // 2 min  — frequent updates during live matches
      : 30 * 60 * 1000; // 30 min — quiet polling between matches

    syncTimer = setTimeout(async () => {
      await syncMatchesFromApi();
      scheduleSyncJob(); // reschedule dynamically after each run
    }, delayMs);
  }

  scheduleSyncJob();

  // Graceful shutdown on SIGTERM (Cloud Run sends this before container termination)
  process.on('SIGTERM', async () => {
    console.log('[Server] SIGTERM received — shutting down gracefully');
    clearTimeout(syncTimer);
    await prisma.$disconnect();
    process.exit(0);
  });
}

start();
