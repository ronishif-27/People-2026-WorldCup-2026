# Deployment Hand-off — Backend (Cloud Run)

**For the engineer deploying this service.**
Owner: Roni Shif (`roni.shif@guesty.com`).

This file is the single checklist between "Roni hands you the repo" and
"the backend is live on Cloud Run." For the full step-by-step `gcloud`
commands, see [`DEPLOY.md`](./DEPLOY.md). For all required env-var names
and shapes, see [`.env.example`](./.env.example).

---

## What's already done (no action needed)

- ✅ **Firestore database** `worldcup-2026-people-team` is provisioned in
  project `ai-innovation-484111`.
  https://console.cloud.google.com/firestore/databases/worldcup-2026-people-team/data/panel?project=ai-innovation-484111
- ✅ **No SQL / Prisma** — backend is fully stateless, persistence is
  Firestore only. No migrations to run at deploy time.
- ✅ **Docker image** builds clean with `gcloud run deploy --source=backend`.
- ✅ **Service binds 0.0.0.0** and reads `PORT` from env (Cloud Run-ready).
- ✅ **OAuth + JWT auth** is implemented end-to-end. No server-side
  session store needed.

---

## What you need from Roni (before deploy)

Share via 1Password / Slack DM — these are **not** in the repo by design.
The shape of every variable is documented in [`.env.example`](./.env.example).

| Goes into Secret Manager | Value source |
| --- | --- |
| `GOOGLE_CLIENT_ID` | Roni — OAuth client in `ai-innovation-484111` |
| `GOOGLE_CLIENT_SECRET` | Roni — pairs with the above |
| `HIBOB_SERVICE_USER_ID` | Roni — HiBob admin → Service Users |
| `HIBOB_SERVICE_USER_TOKEN` | Roni — pairs with the above |
| `FOOTBALL_DATA_API_KEY` | Roni — football-data.org free-tier key |

| Goes into env vars (not secret) | Value |
| --- | --- |
| `FIREBASE_PROJECT_ID` | `ai-innovation-484111` |
| `FIRESTORE_DATABASE_ID` | `worldcup-2026-people-team` |
| `ADMIN_EMAILS` | `roni.shif@guesty.com,yeela.tal@guesty.com,olga.stempin@guesty.com` |
| `JWT_EXPIRES_IN` | `24h` |
| `NODE_ENV` | `production` |
| `FRONTEND_URL` | Confirm with Roni once frontend is hosted (likely a Firebase Hosting URL or `worldcup.guesty.com`) |

| You generate fresh | How |
| --- | --- |
| `JWT_SECRET` | `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"` — store in Secret Manager. Do NOT reuse Roni's local-dev value. |

---

## The deploy itself

Follow [`DEPLOY.md`](./DEPLOY.md) sections **2 → 6** in order:

1. Create the runtime service account (`worldcup-backend-runtime`) and
   bind `roles/datastore.user` + `roles/secretmanager.secretAccessor`.
2. Create the six Secret Manager secrets (values from Roni above).
3. Run the `gcloud run deploy worldcup-backend --source=backend …` block.
4. Hit `/health` to verify Firestore connectivity. Logs should show
   `Firestore : ai-innovation-484111 / worldcup-2026-people-team`.

---

## What you send back to Roni (after first deploy)

1. **The Cloud Run service URL** (looks like
   `https://worldcup-backend-xxxxx-uc.a.run.app`).

Roni then:
- Adds `<URL>/api/auth/callback` to the OAuth client's Authorised Redirect
  URIs in https://console.cloud.google.com/apis/credentials.
- Sets `VITE_API_URL=<URL>` for the frontend build before deploying it to
  Firebase Hosting.

You then redeploy **once more** with:

```bash
--set-env-vars="GOOGLE_CALLBACK_URL=<URL>/api/auth/callback"
```

That's it.

---

## How to verify it's actually working

Beyond `/health`, do an end-to-end check:

```bash
# Should redirect to accounts.google.com
curl -sI https://<URL>/api/auth/google | head -1

# Should return 401 (no token)
curl -s https://<URL>/api/matches
```

Then in the Firestore console, switch the database dropdown to
`worldcup-2026-people-team` — after the first login you should see
`wc_users` / `wc_matches` collections. **They must NOT appear under
`aiinnovationhubv3`** (that's another team's database — if data lands
there, something is wrong with `FIRESTORE_DATABASE_ID`).
