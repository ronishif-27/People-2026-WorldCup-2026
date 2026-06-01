/**
 * routes/events.routes.ts
 *
 * GET /api/events/stream
 * Server-Sent Events stream powering the Live Activity Feed.
 *
 * Why SSE (not WebSocket): we're on Cloud Run + Firestore. SSE works over
 * HTTP/1.1, requires no extra infra, and the broadcast layer IS Firestore —
 * each Cloud Run instance opens its own server-side onSnapshot listener and
 * pushes to its connected SSE clients. Cross-instance fan-out is "free"
 * because every instance independently observes the same Firestore stream.
 *
 * Auth: EventSource cannot set custom headers, so we accept the JWT via
 * `?token=<jwt>` query param. The token is the same one used for Bearer
 * auth elsewhere — verifyToken() applies the same checks.
 *
 * Wire format: standard SSE. Each new wc_activity doc is sent as a single
 * `event: activity\ndata: {...json...}\n\n` frame. A `: ping` comment line
 * is sent every 25s to keep intermediary proxies from closing the socket.
 */

import { Router, Request, Response } from 'express';
import { getDb, C } from '../db/firebase.js';
import { verifyToken } from '../services/jwt.service.js';

export const eventsRouter = Router();

interface ActivityPayload {
  id: string;
  type: string;
  userId: string;
  userName: string;
  department: string;
  site: string;
  avatarUrl: string | null;
  matchLabel?: string;
  matchId?: string;
  points?: number;
  fromRank?: number;
  toRank?: number;
  direction?: 'UP' | 'DOWN';
  createdAt: string;
}

eventsRouter.get('/stream', (req: Request, res: Response): void => {
  // ── Auth via ?token=<JWT> (EventSource can't set Authorization header) ──
  const token = (req.query.token as string | undefined) ?? '';
  if (!token) {
    res.status(401).json({ error: 'UNAUTHORIZED' });
    return;
  }
  try {
    verifyToken(token);
  } catch {
    res.status(401).json({ error: 'INVALID_TOKEN' });
    return;
  }

  // ── SSE headers ─────────────────────────────────────────────────────────
  res.setHeader('Content-Type',  'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection',    'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // disable proxy buffering
  res.flushHeaders?.();

  // Initial comment frame so the client knows the stream is alive
  res.write(': connected\n\n');

  // ── Heartbeat (every 25s) so Cloud Run / intermediaries keep us open ────
  const heartbeat = setInterval(() => {
    res.write(`: ping ${Date.now()}\n\n`);
  }, 25_000);

  // ── Firestore listener: stream new activity docs as they appear ─────────
  // We use a server-side onSnapshot. The first snapshot delivers the latest
  // 50 docs; after that, each `added` change is pushed individually.
  // (We send only docChanges() of type 'added' so clients aren't spammed
  // with the same backlog on every change.)
  let firstSnapshot = true;
  const unsubscribe = getDb().collection(C.ACTIVITY)
    .orderBy('createdAt', 'desc')
    .limit(50)
    .onSnapshot(
      (snap) => {
        if (firstSnapshot) {
          // Initial backlog → send as a single 'backlog' event so the client
          // can hydrate its ticker on connect.
          const items = snap.docs.map(d => toPayload(d.id, d.data()));
          res.write(`event: backlog\ndata: ${JSON.stringify({ items })}\n\n`);
          firstSnapshot = false;
          return;
        }
        // Subsequent updates — push only newly added rows.
        for (const change of snap.docChanges()) {
          if (change.type !== 'added') continue;
          const payload = toPayload(change.doc.id, change.doc.data());
          res.write(`event: activity\ndata: ${JSON.stringify(payload)}\n\n`);
        }
      },
      (err) => {
        console.error('[Events] Firestore listener error:', err);
        res.write(`event: error\ndata: ${JSON.stringify({ message: 'listener_error' })}\n\n`);
      },
    );

  // ── Clean up when the client disconnects ─────────────────────────────────
  req.on('close', () => {
    clearInterval(heartbeat);
    unsubscribe();
    res.end();
  });
});

function toPayload(id: string, d: FirebaseFirestore.DocumentData): ActivityPayload {
  const created = d.createdAt instanceof Date
    ? d.createdAt
    : d.createdAt?.toDate?.() ?? new Date();
  return {
    id,
    type:       d.type ?? 'PREDICTED',
    userId:     d.userId,
    userName:   d.userName,
    department: d.department ?? '',
    site:       d.site ?? '',
    avatarUrl:  d.avatarUrl ?? null,
    matchId:    d.matchId,
    matchLabel: d.matchLabel,
    points:     d.points,
    fromRank:   d.fromRank,
    toRank:     d.toRank,
    direction:  d.direction,
    createdAt:  created.toISOString(),
  };
}
