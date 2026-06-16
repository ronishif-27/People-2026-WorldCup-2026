# Backend Deployment Guide — Cloud Run

> **Start here:** [`HANDOFF.md`](./HANDOFF.md) is the high-level checklist
> covering what's done, what you need from Roni, and the post-deploy steps.
> This file is the detailed `gcloud` runbook referenced from it. Required
> env vars and their shapes live in [`.env.example`](./.env.example).

This document is for the engineer deploying the Guesty World Cup 2026 backend
to Google Cloud Run. Everything in this directory is production-ready; the
backend is stateless (all persistence in Firestore) so you can deploy directly
with `gcloud run deploy`.

## Hand-off checklist — what you need from Roni

These values exist in Roni's local `backend/.env` and are **not** in the
repo (deliberately — secrets never get committed). Get them from her over
1Password / Slack DM before deploying:

| Secret name (Secret Manager) | What it is |
| --- | --- |
| `JWT_SECRET` | 64-char random string. If lost, just generate a new one with `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"` — only effect is that existing sessions invalidate. |
| `GOOGLE_CLIENT_ID` | OAuth 2.0 Client ID (Google Cloud Console → APIs & Credentials) |
| `GOOGLE_CLIENT_SECRET` | OAuth 2.0 Client Secret — pairs with the above |
| `HIBOB_SERVICE_USER_ID` | HiBob service-user ID (provisioned by Roni in HiBob admin) |
| `HIBOB_SERVICE_USER_TOKEN` | HiBob service-user token — pairs with the above |
| `FOOTBALL_DATA_API_KEY` | football-data.org free-tier API key |

You also need from Roni:
- The eventual **frontend URL** (Firebase Hosting URL or custom domain) for
  `FRONTEND_URL` and CORS.

After your **first** Cloud Run deploy, send the resulting Cloud Run service
URL back to Roni — she needs it to:
1. Add `<service-url>/api/auth/callback` to the Google OAuth client as an
   authorised redirect URI.
2. Set `VITE_API_URL=<service-url>` for the frontend build.

Then you redeploy once more with `GOOGLE_CALLBACK_URL=<service-url>/api/auth/callback`.

## Architecture summary

- **Runtime:** Node.js 20 (Alpine) in a multi-stage Docker image.
- **Persistence:** Cloud Firestore (Native mode), database name
  `worldcup-2026-people-team`, in project `ai-innovation-484111`. All
  collections are prefixed `wc_` for isolation.
- **Auth:** Google OAuth 2.0 → JWT (HS256, 24h). State is purely in the JWT;
  no server-side session store.
- **External:** HiBob (employee directory), football-data.org (match results).
- **Port:** Cloud Run sets `PORT`; we listen on `0.0.0.0:$PORT`.

The server has no startup migrations — Firestore is schemaless and collections
are created lazily on first write. Cold start is ~1.5s.

## Prerequisites

GCP project: `ai-innovation-484111`. APIs that must be enabled:
- Cloud Run Admin API
- Artifact Registry API
- Cloud Firestore API
- Secret Manager API (for storing OAuth + HiBob tokens)
- Cloud Build API (only if using `gcloud run deploy --source`)

You will need IAM:
- `roles/run.admin`
- `roles/iam.serviceAccountUser`
- `roles/secretmanager.admin` (to create secrets)
- `roles/datastore.user` on the `worldcup` database (the runtime service
  account, not your user — see below)

## 1. Firestore database — already provisioned

A dedicated database `worldcup-2026-people-team` has already been created
in project `ai-innovation-484111`:

> https://console.cloud.google.com/firestore/databases/worldcup-2026-people-team/data/panel?project=ai-innovation-484111

This is the database the backend must target — set
`FIRESTORE_DATABASE_ID=worldcup-2026-people-team` on the Cloud Run service.

**Do not** reuse the existing `aiinnovationhubv3` database — it belongs to
another team.

## 2. Service account for Cloud Run (one-time)

Create a dedicated runtime service account so the backend can read/write
Firestore via Application Default Credentials:

```bash
PROJECT=ai-innovation-484111
SA=worldcup-backend-runtime

gcloud iam service-accounts create $SA \
  --display-name="World Cup Backend Runtime" \
  --project=$PROJECT

# Read/write Firestore (scoped to the worldcup database via the runtime check)
gcloud projects add-iam-policy-binding $PROJECT \
  --member="serviceAccount:${SA}@${PROJECT}.iam.gserviceaccount.com" \
  --role="roles/datastore.user"

# Permission to read Secret Manager secrets at runtime
gcloud projects add-iam-policy-binding $PROJECT \
  --member="serviceAccount:${SA}@${PROJECT}.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

## 3. Store secrets in Secret Manager (one-time)

Never bake secrets into the image. Create these secrets — values come from
Roni's local `.env`:

```bash
PROJECT=ai-innovation-484111

for name in JWT_SECRET GOOGLE_CLIENT_ID GOOGLE_CLIENT_SECRET \
            HIBOB_SERVICE_USER_ID HIBOB_SERVICE_USER_TOKEN \
            FOOTBALL_DATA_API_KEY; do
  echo -n "<paste value>" | gcloud secrets create $name \
    --data-file=- --project=$PROJECT
done
```

To rotate later: `gcloud secrets versions add $NAME --data-file=- ...`.

## 4. Configure Google OAuth redirect URI (one-time)

In https://console.cloud.google.com/apis/credentials, edit the OAuth 2.0
Client ID and add to **Authorised redirect URIs**:

```
https://<your-cloud-run-service-url>/api/auth/callback
```

You will not know the Cloud Run URL until after the first deploy. You can
either deploy once to get the URL and then add it, or pre-create a custom
domain.

## 5. Deploy

The simplest path uses `gcloud run deploy --source` which builds the image
with Cloud Build and pushes it to Artifact Registry automatically.

From the **repository root** (not from `backend/`):

```bash
PROJECT=ai-innovation-484111
SA=worldcup-backend-runtime
REGION=us-central1
FRONTEND_URL=https://<your-firebase-hosting-url>

gcloud run deploy worldcup-backend \
  --source=backend \
  --region=$REGION \
  --project=$PROJECT \
  --service-account="${SA}@${PROJECT}.iam.gserviceaccount.com" \
  --allow-unauthenticated \
  --port=8080 \
  --memory=512Mi \
  --cpu=1 \
  --min-instances=0 \
  --max-instances=10 \
  --timeout=60s \
  --set-env-vars="NODE_ENV=production" \
  --set-env-vars="FIREBASE_PROJECT_ID=${PROJECT}" \
  --set-env-vars="FIRESTORE_DATABASE_ID=worldcup-2026-people-team" \
  --set-env-vars="FRONTEND_URL=${FRONTEND_URL}" \
  --set-env-vars="JWT_EXPIRES_IN=24h" \
  --set-env-vars="ADMIN_EMAILS=roni.shif@guesty.com,yeela.tal@guesty.com,olga.stempin@guesty.com" \
  --set-env-vars="GOOGLE_CALLBACK_URL=https://<filled-after-first-deploy>/api/auth/callback" \
  --set-secrets="JWT_SECRET=JWT_SECRET:latest" \
  --set-secrets="GOOGLE_CLIENT_ID=GOOGLE_CLIENT_ID:latest" \
  --set-secrets="GOOGLE_CLIENT_SECRET=GOOGLE_CLIENT_SECRET:latest" \
  --set-secrets="HIBOB_SERVICE_USER_ID=HIBOB_SERVICE_USER_ID:latest" \
  --set-secrets="HIBOB_SERVICE_USER_TOKEN=HIBOB_SERVICE_USER_TOKEN:latest" \
  --set-secrets="FOOTBALL_DATA_API_KEY=FOOTBALL_DATA_API_KEY:latest"
```

After the first deploy, capture the service URL and re-deploy with
`GOOGLE_CALLBACK_URL` filled in, then add that URL to the OAuth client
(step 4).

`--allow-unauthenticated` is correct: our app gates access in the Express
layer (Google OAuth + JWT), not at the Cloud Run boundary. Cloud Run IAM
auth would block the frontend from calling the API.

## 6. Verify

```bash
URL=$(gcloud run services describe worldcup-backend \
  --region=$REGION --project=$PROJECT --format='value(status.url)')

# Health check writes to wc_health/ping in Firestore
curl -s $URL/health | jq
# → {"status":"ok","db":"firestore","timestamp":"..."}

# Logs
gcloud run services logs read worldcup-backend \
  --region=$REGION --project=$PROJECT --limit=50
```

On first request you should see in logs:

```
🚀 Worldcup API listening on 0.0.0.0:8080
   Firestore   : ai-innovation-484111 / worldcup-2026-people-team
✅ Firestore connected
```

Then in the GCP Console, switch the Firestore database dropdown to
`worldcup-2026-people-team` and confirm `wc_users` / `wc_matches`
collections appear there.

## Updating

Every redeploy is a fresh container; just rerun the same `gcloud run deploy`
command. Cloud Run does a zero-downtime rollout.

To roll back: `gcloud run services update-traffic worldcup-backend --to-revisions=<prior-revision>=100`.

## Local image testing (optional)

Verify the production image works locally before deploying:

```bash
# Build
docker build -t worldcup-backend:local -f backend/Dockerfile backend

# Run with local .env + service-account JSON mounted
docker run --rm -p 8080:8080 \
  --env-file backend/.env \
  -v $(pwd)/backend/firebase-service-account.json:/secrets/sa.json:ro \
  -e GOOGLE_APPLICATION_CREDENTIALS=/secrets/sa.json \
  worldcup-backend:local

curl http://localhost:8080/health
```

## What is NOT in this repo (intentionally)

- No `cloudbuild.yaml` — `gcloud run deploy --source` handles the build.
- No Terraform / IaC — infra here is small and provisioned manually.
- No service account JSON in version control — `firebase-service-account.json`
  is gitignored and only used for local development. Cloud Run gets credentials
  from the attached service account via ADC.
