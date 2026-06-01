# Re-Deploy Brief — June 1, 2026

**For the engineer redeploying the World Cup app to Cloud Run.**
Owner: Roni Shif (`roni.shif@guesty.com`).

You've already deployed once. This is the diff since then — what's new in
the code, what you must change in the deploy configuration, and what to
verify in production. **Both frontend and backend are on Cloud Run.**

---

## TL;DR

1. **Pull and redeploy** from branch `feature/live-activity-feed` — it
   includes everything (it's stacked on `feature/backend-auth-matches-onboarding`).
2. **One new backend env var:** `FIRESTORE_DATABASE_ID=worldcup-2026-people-team`
   (if you set it last time, good — re-confirm it's still there).
3. **Frontend now uses React Router** — your hosting MUST rewrite any
   unknown path to `/index.html` or hard-refreshes on `/predictions`,
   `/leaderboard`, etc. will 404. See §3.
4. **New SSE endpoint** `/api/events/stream` — long-lived HTTP. Cloud Run
   handles it natively but be aware of the timeout knob. See §4.
5. **Data-model breaking change:** field renamed `totalPoints → coinBalance`
   in `wc_users` and `wc_scores`. Read-side fallback to `totalPoints` is
   in place. If you point at the production Firestore DB and want clean
   numbers, delete the legacy `totalPoints` field on existing user docs
   (one-liner in §5).
6. **Verify after deploy** that data lands in `worldcup-2026-people-team`
   and NOT `aiinnovationhubv3` (the other team's DB). See §6.

---

## 1. Source branch

Deploy from:

```
git fetch origin
git checkout feature/live-activity-feed
git pull
```

That branch is the head of all today's work. It rebases cleanly on
`feature/backend-auth-matches-onboarding` (the previous deploy base).
PR #1 → main and PR #2 → PR #1 are both open on GitHub.

You can deploy directly from this branch without waiting for the merges —
or merge both PRs to main first, then deploy from main. Your call.

---

## 2. New backend env var

Only **one** new variable since last time:

```
FIRESTORE_DATABASE_ID=worldcup-2026-people-team
```

Without it, the backend silently writes to the `(default)` Firestore
database instead of the one Roni provisioned. **If you don't see her
test users in `worldcup-2026-people-team`, this env var is missing.**
(See §6 for the live-mystery check.)

Everything else is identical to last deploy. The full env-var list is
in `backend/.env.example` and `backend/HANDOFF.md`.

---

## 3. Frontend — SPA routing fallback REQUIRED

The frontend now uses `react-router-dom` (PR #2, commit `d6647f2`). Pages:

| URL | Route |
|---|---|
| `/` | Dashboard |
| `/predictions` | Place Predictions |
| `/leaderboard` | Leaderboard |
| `/rules` | How to Play |
| `/admin` | Admin (ADMIN role only) |
| `/auth/callback?token=...` | OAuth callback (token in query) |

**A hard refresh on any non-root URL must serve `/index.html`.** The
React router takes over from there.

### If your frontend Cloud Run uses nginx:

The repo now ships `Dockerfile` + `nginx.conf` at the root with the
correct fallback already configured (`try_files $uri $uri/ /index.html;`).
Build with:

```bash
gcloud run deploy worldcup-frontend \
  --source=. \
  --region=us-central1 \
  --build-arg=VITE_API_URL=https://<backend-cloud-run-url> \
  --port=8080
```

**`VITE_API_URL` must be passed as a build arg, not an env var** —
Vite bakes it into the static bundle at build time. Cloud Run env vars
do not flow into client-side code.

### If your frontend setup is different from this Dockerfile:

That's fine — just confirm that:
1. Unknown paths fall back to `/index.html` (try `curl -I https://<frontend>/predictions` — it should 200, not 404)
2. The build was done with `VITE_API_URL=<backend-url>`

---

## 4. New SSE endpoint — Cloud Run notes

`GET /api/events/stream` is a Server-Sent Events stream powering the live
activity ticker. Long-lived HTTP connection with `Content-Type: text/event-stream`.

What to know:
- Cloud Run **request timeout default is 5 minutes**. Set it to **60 minutes**
  (the max) for the backend service so SSE connections don't get cut every
  5 min:
  ```bash
  --timeout=3600s
  ```
- We send a `: ping` heartbeat every 25s, so intermediate proxies won't
  drop the socket idle.
- The backend sets `X-Accel-Buffering: no` to disable proxy buffering.
- Browser `EventSource` auto-reconnects on any disconnect — even if you
  hit the 60-min cap, users won't notice.

---

## 5. Data-model deltas

Three changes to be aware of inside Firestore:

### `wc_users` — new fields
- `coinBalance` (number) — replaces `totalPoints` (still tolerated for read)
- `predictionCount` (number) — atomic counter, incremented on first
  prediction per match

### `wc_scores` — field renamed
- `coins` (number) — replaces `points` (still tolerated for read)

### New collections
- `wc_match_events` — append-only log of match status transitions
  (UPCOMING → LIVE → FINISHED) and live score updates. Used by SSE.
- (Existing `wc_activity` event types extended: `PREDICTED`, `COINS_EARNED`, `RANK_CHANGED`)

### Optional one-time cleanup

If existing user docs in production have stale `totalPoints` values from
the previous (incorrect) scoring formula, run this once:

```js
// One-time cleanup inside a node REPL with firebase-admin loaded
const users = await db.collection('wc_users').get();
for (const d of users.docs) {
  await d.ref.update({
    coinBalance: 0,
    totalPoints: admin.firestore.FieldValue.delete(),
  });
}
```

Nothing real has been scored yet (WC hasn't started), so a clean reset
is safe.

---

## 6. Verification — and the open question

After the redeploy:

**Backend smoke:**
```bash
URL=https://<your-backend>.run.app
curl -s $URL/health | jq
# → {"status":"ok","db":"firestore","timestamp":"..."}

# Logs should show:
#   🚀 Worldcup API listening on 0.0.0.0:8080
#   Firestore   : ai-innovation-484111 / worldcup-2026-people-team
#   ✅ Leaderboard cache warm (N users)
```

**Frontend smoke:**
```bash
curl -I https://<your-frontend>.run.app/predictions
# → HTTP/2 200 (not 404)
```

**SSE smoke:**
```bash
TOKEN=<a valid JWT from a logged-in session>
curl -sN "https://<your-backend>.run.app/api/events/stream?token=$TOKEN" | head -5
# Should see:
#   : connected
#   event: backlog
#   data: {"items":[...]}
```

### ⚠️ The user-data mystery to confirm

Roni reports that users are populating in production (she sees them in
the live app) but **not in the `worldcup-2026-people-team` Firestore DB**
she has access to.

Two possible causes — please confirm which one:

1. **The Cloud Run service is missing `FIRESTORE_DATABASE_ID=worldcup-2026-people-team`.** In that case writes go to the `(default)` database, which Roni may not have console access to. Fix: add the env var, redeploy.
2. **You created a different Firestore database during your initial deploy** (e.g. a fresh `(default)` or another named one). In that case data is in the right backend but the wrong DB from Roni's POV. Fix: tell Roni which DB ID the backend is currently pointed at, and either grant her IAM access to it OR point the backend at `worldcup-2026-people-team`.

The signal: in Cloud Run logs after a request, you should see exactly:
```
Firestore : ai-innovation-484111 / worldcup-2026-people-team
```

If you see `(default)` or anything else, that's the mismatch.

---

## 7. Full change summary since last deploy

Commits since `bc81ab4` (the version you last deployed), grouped by area:

**Bug fixes (PR #1, after your initial deploy):**
- `73b64de` Onboarding succeeds for real HiBob department names
- `73b64de` Leaderboard / users-stats queries no longer require composite indexes
- `4481eef` Predictions page populates (API response shape fix + WC 2026 season guard)

**Live Activity Feed (PR #2):**
- `09b0f2a` SSE infrastructure (`/api/events/stream`), `useLiveActivity` hook,
  scoring writes `POINTS_EARNED` + `RANK_CHANGED` events, leaderboard 6-column
  redesign with real persistence (`predictionCount` field)
- `d6647f2` BrowserRouter — every page has a real URL
- `0d5283e` Match state machine — UPCOMING / LIVE / FINISHED renders in UI,
  source of truth is football-data.org API (admin lock removed from primary path)
- `1fc60ba` Scoring model rewrite — coins-only, 100% / 50% + 25 first-goal
  bonus. Field rename `totalPoints` → `coinBalance` across the stack
- `a0e05bc` Server-side leaderboard cache — ~200× fewer Firestore reads at
  the 1000-user scale

**Known gap (waiting on team input):**
- Outright resolution: football-data.org free tier doesn't return goal-by-goal
  or bookings data. Top Scorer auto-resolves via `/competitions/WC/scorers`;
  the other 3 outrights (Most Red Cards, Total Headed Goals, Time of First
  Goal) need either paid tier or admin manual entry. Tracked, no action
  required for this deploy.
