/**
 * useLiveActivity — opens an SSE stream to /api/events/stream and exposes
 * a rolling buffer of the last N activity events.
 *
 * Why SSE (not WebSocket): the backend runs on Cloud Run + Firestore.
 * The backend's onSnapshot listener pushes new wc_activity rows to each
 * connected client over `text/event-stream`. EventSource handles
 * auto-reconnect; we accept JWT via ?token=<jwt> since EventSource cannot
 * set custom headers.
 *
 * Privacy: per PRD §6.4, predicted scores are not included in the payload
 * for PREDICTED events — the server omits them. The hook just renders
 * whatever the server sent.
 */

import { useEffect, useRef, useState } from 'react';

export interface LiveActivityEvent {
  id:         string;
  type:       'PREDICTED' | 'COINS_EARNED' | 'RANK_CHANGED' | string;
  userId:     string;
  userName:   string;
  department: string;
  site:       string;
  avatarUrl:  string | null;
  matchId?:   string;
  matchLabel?: string;
  coins?:     number;   // populated on COINS_EARNED events
  fromRank?:  number;
  toRank?:    number;
  direction?: 'UP' | 'DOWN';
  createdAt:  string;
}

interface BacklogFrame { items: LiveActivityEvent[]; }

/** Payload of an `event: match` SSE frame — emitted whenever a match
 *  status transitions (UPCOMING → LIVE → FINISHED) or its live score updates. */
export interface LiveMatchEvent {
  id:        string;
  matchId:   string;
  kind:      'STATUS_CHANGED' | 'SCORE_UPDATED' | string;
  from:      string | null;
  to:        string;
  scoreA:    number | null;
  scoreB:    number | null;
  minute:    string | null;
  teamA:     string;
  teamB:     string;
  createdAt: string;
}

/**
 * Subscribe to the live activity + match-event stream.
 *
 * Returns a rolling buffer of activity events for the ticker AND fires the
 * onMatchEvent callback whenever a match status changes (UPCOMING → LIVE →
 * FINISHED) or a live score updates. The caller uses onMatchEvent to patch
 * the local match cache so cards flip state without a refresh.
 *
 * @param token         JWT bearer token — passed via query param to EventSource.
 * @param limit         Max number of activity events kept in the buffer (default 5).
 * @param enabled       Pause the stream when false (e.g. user signed out).
 * @param onMatchEvent  Optional callback for `event: match` frames.
 */
export function useLiveActivity(
  token: string | null,
  limit = 5,
  enabled = true,
  onMatchEvent?: (ev: LiveMatchEvent) => void,
): LiveActivityEvent[] {
  const [events, setEvents] = useState<LiveActivityEvent[]>([]);
  const esRef = useRef<EventSource | null>(null);
  // Keep the latest onMatchEvent in a ref so we don't tear down the SSE
  // connection every time the caller passes a new closure.
  const onMatchEventRef = useRef(onMatchEvent);
  useEffect(() => { onMatchEventRef.current = onMatchEvent; }, [onMatchEvent]);

  useEffect(() => {
    if (!enabled || !token) return;

    const base = import.meta.env.VITE_API_URL ?? '';
    const url  = `${base}/api/events/stream?token=${encodeURIComponent(token)}`;

    const es = new EventSource(url);
    esRef.current = es;

    es.addEventListener('backlog', (e) => {
      try {
        const parsed = JSON.parse((e as MessageEvent).data) as BacklogFrame;
        setEvents(parsed.items.slice(0, limit));
      } catch { /* ignore */ }
    });

    es.addEventListener('activity', (e) => {
      try {
        const ev = JSON.parse((e as MessageEvent).data) as LiveActivityEvent;
        setEvents(prev => {
          if (prev.some(p => p.id === ev.id)) return prev;
          return [ev, ...prev].slice(0, limit);
        });
      } catch { /* ignore */ }
    });

    es.addEventListener('match', (e) => {
      try {
        const ev = JSON.parse((e as MessageEvent).data) as LiveMatchEvent;
        onMatchEventRef.current?.(ev);
      } catch { /* ignore */ }
    });

    es.onerror = () => {
      // EventSource auto-reconnects on error; no action needed.
    };

    return () => {
      es.close();
      esRef.current = null;
    };
  }, [token, limit, enabled]);

  return events;
}

/**
 * Format a LiveActivityEvent as a short human sentence for the ticker.
 * Predicted scores are intentionally NOT included (PRD §6.4 privacy rule).
 */
export function formatActivityText(ev: LiveActivityEvent): string {
  const who = `${ev.userName} (${ev.department || '—'}, ${ev.site || '—'})`;
  switch (ev.type) {
    case 'PREDICTED':
      return `${who} placed a prediction on ${ev.matchLabel ?? 'a match'}`;
    case 'COINS_EARNED':
      return `${who} earned ${ev.coins ?? 0} coins on ${ev.matchLabel ?? 'a match'}`;
    case 'RANK_CHANGED':
      if (ev.direction === 'UP' && ev.toRank != null) {
        return `${who} climbed to rank #${ev.toRank}`;
      }
      if (ev.toRank != null) {
        return `${who} dropped to rank #${ev.toRank}`;
      }
      return `${who} changed rank`;
    default:
      return `${who} did something`;
  }
}

/** Short relative-time label for the ticker (e.g. "Just now", "3m ago"). */
export function formatActivityTime(createdAt: string): string {
  const ts = new Date(createdAt).getTime();
  const diffSec = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (diffSec < 30)    return 'Just now';
  if (diffSec < 60)    return `${diffSec}s ago`;
  if (diffSec < 3600)  return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return new Date(createdAt).toLocaleDateString();
}
