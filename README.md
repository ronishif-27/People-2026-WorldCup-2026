# ⚽ Guesty World Cup 2026 — Employee Prediction Portal

<div align="center">
  <img src="https://img.shields.io/badge/FIFA%202026-World%20Cup-14665F?style=for-the-badge" alt="FIFA 2026" />
  <img src="https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react" alt="React 19" />
  <img src="https://img.shields.io/badge/TypeScript-5.8-3178C6?style=for-the-badge&logo=typescript" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Vite-6-646CFF?style=for-the-badge&logo=vite" alt="Vite" />
  <img src="https://img.shields.io/badge/Google%20Cloud-Run-4285F4?style=for-the-badge&logo=google-cloud" alt="Google Cloud" />
</div>

---

## 📖 Overview

**Guesty World Cup 2026** is a company-wide FIFA World Cup prediction game built for ~1,000 Guesty employees across 7 global offices. Employees log in with their Guesty Google account, predict match scores for all 104 FIFA 2026 tournament matches, earn points, and compete on a real-time leaderboard grouped by department and office site.

> **Tournament Deadline:** All pre-tournament predictions must be submitted before **June 10, 2026 00:00 UTC**. Individual match predictions lock at each match's kickoff time.

---

## 🏗️ Current State — Prototype

The current codebase (`main` branch) is a **client-side-only prototype** built in Google AI Studio. It demonstrates the full game UX but uses **localStorage** for all state — no backend, no real authentication, no shared data between users.

### What the prototype includes:
| Component | File | Status |
|---|---|---|
| Login screen (name/email/dept/site form) | `LoginScreen.tsx` | ✅ UI only |
| Onboarding welcome modal (2-phase) | `Onboarding.tsx` | ✅ UI only |
| Dashboard Hub (stats, feed, match preview) | `App.tsx` | ✅ UI only |
| Match prediction cards + first-goal picker | `MatchPredictor.tsx` | ✅ UI only |
| Outright tournament predictions | `MatchPredictor.tsx` | ✅ UI only |
| Animated leaderboard with filters | `Leaderboard.tsx` | ✅ Simulated |
| Countdown clock to June 10 deadline | `CountdownClock.tsx` | ✅ Functional |
| Admin control panel (matches, scores, CSV) | `AdminPanel.tsx` | ✅ UI only |
| Rules / "How to Play" page | `App.tsx` | ✅ Static |
| Scoring engine (exact/winner/miss) | `utils/scoring.ts` | ✅ Client-side |

---

## 🚀 Production Architecture

The prototype must be transformed into a production-ready system before June 10, 2026. The target stack:

```
┌─────────────────────────────────────────────────────────┐
│                    CLIENT (Browser)                     │
│         React 19 + TypeScript SPA (Vite build)         │
│              Firebase Hosting / Cloud CDN               │
└──────────────────────┬──────────────────────────────────┘
                       │ REST + WebSocket
┌──────────────────────▼──────────────────────────────────┐
│                 BACKEND API SERVICE                      │
│    Node.js 20 LTS + TypeScript + Fastify (or Express)  │
│                  Google Cloud Run                        │
│     JWT Auth  │  BullMQ Jobs  │  Socket.IO WebSockets  │
└─────┬────────────────┬────────────────┬─────────────────┘
      │                │                │
┌─────▼──────┐  ┌──────▼──────┐  ┌─────▼──────┐
│ Cloud SQL  │  │   Redis     │  │  External  │
│ PostgreSQL │  │ (Memorystore│  │  Services  │
│            │  │  BullMQ +   │  │            │
│ - Users    │  │  Cache)     │  │ football-  │
│ - Matches  │  └─────────────┘  │ data.org   │
│ - Predictions│                 │ HiBob API  │
│ - Scores   │                   │ Slack API  │
│ - T&C logs │                   │ SendGrid   │
└────────────┘                   └────────────┘
```

### Technology Decisions

| Layer | Technology | Rationale |
|---|---|---|
| Frontend | React 19 + TypeScript + Vite | Existing prototype stack — no rebuild needed |
| Styling | Tailwind CSS v4 | Already used in prototype |
| Animations | Framer Motion (motion) | Already in prototype |
| Backend | Node.js 20 LTS + Fastify | Matches frontend language; fast startup for Cloud Run |
| ORM | Prisma | Type-safe; generates migrations from schema |
| Database | Cloud SQL — PostgreSQL 15 | ACID; relational game data |
| Cache / Jobs | Redis (Cloud Memorystore) + BullMQ | Leaderboard cache; match lock cron jobs; Safe Pick automation |
| Auth | **Google OAuth 2.0** (Workspace SSO) | Employees already have Guesty Google accounts |
| Real-time | Socket.IO WebSockets | Push live scores + leaderboard updates to all clients |
| HR data | HiBob REST API | Sync department, site, team, employment status |
| World Cup data | **football-data.org** (free tier) | Live scores, fixtures, tournament brackets for all 104 matches |
| Notifications | Slack Incoming Webhook + SendGrid | Post rankings to Slack; send reminder/result emails |
| Hosting | Google Cloud Run (API) + Firebase Hosting (SPA) | Per-request scaling; CDN delivery |
| CI/CD | GitHub Actions | Lint → type-check → build → deploy on merge to main |
| Monitoring | Cloud Monitoring + Sentry | Error tracking on frontend and backend |

---

## 🗂️ Project Structure

```
/
├── src/
│   ├── App.tsx                  # Root state management, routing, sidebar nav
│   ├── main.tsx                 # React entry point
│   ├── index.css                # Global styles / Tailwind config
│   ├── types.ts                 # Shared TypeScript interfaces (Match, Prediction, Employee)
│   ├── components/
│   │   ├── LoginScreen.tsx      # Login form → replace with Google OAuth redirect
│   │   ├── Onboarding.tsx       # Welcome + Betting Rules modal (2-phase) → add T&C gate
│   │   ├── MatchPredictor.tsx   # Match prediction cards + outright predictions
│   │   ├── Leaderboard.tsx      # Rankings grid with dept/site filters and live feed
│   │   ├── AdminPanel.tsx       # Admin: match CRUD, score updates, CSV export
│   │   ├── CountdownClock.tsx   # Countdown to June 10 deadline
│   │   ├── SmartGoalSelector.tsx# ± stepper for goal count input
│   │   └── GuestyLogo.tsx       # Guesty SVG logo component
│   ├── data/
│   │   └── mockData.ts          # PROTOTYPE ONLY: hardcoded matches + employees → delete in prod
│   └── utils/
│       └── scoring.ts           # Scoring engine → keep for client-side preview display
├── index.html
├── package.json
├── vite.config.ts
├── tsconfig.json
├── .env.example                 # Required environment variables template
└── metadata.json                # AI Studio project metadata
```

---

## 📊 Data Model (Production)

```
User           — Guesty employee (SSO-provisioned); role: USER | ADMIN
Match          — Tournament fixture; status: UPCOMING → LOCKED → LIVE → FINISHED
Prediction     — User score forecast per match; UNIQUE(user_id, match_id)
OutrightPrediction — Tournament-wide specials (top scorer, red cards, headed goals)
Score          — Computed points after match finishes; type: exact | winner | miss
TermsAcceptance — T&C acceptance record per user (timestamp + IP)
Notification   — Log of sent emails and Slack messages
```

---

## 🎯 Scoring Rules

| Outcome | Points |
|---|---|
| Exact score predicted (e.g. predicted 2-1, actual 2-1) | **100 pts** |
| Correct winner or correct draw (wrong score) | **40 pts** |
| Incorrect outcome | **0 pts** |
| First goal time range correct (per-match bonus) | **+25 pts** |
| Outright prediction correct (top scorer / red cards / headed goals) | **TBD — configurable constant** |

### Coin Values by Stage

| Stage | Coins Earned on Correct Prediction |
|---|---|
| Group Stage | 🪙 250 |
| Round of 32 | 🪙 350 |
| Round of 16 | 🪙 450 |
| Quarterfinals | 🪙 500 |
| Semifinals | 🪙 1,000 |
| Final | 🪙 2,000 |

---

## 🔐 Authentication & Roles

| Role | Access | Leaderboard |
|---|---|---|
| **User** (all Guesty employees) | Dashboard, Predictions, Leaderboard, Rules | ✅ Ranked |
| **Admin** (Yeela, Olga, designated) | All user views + Admin Control Center | ❌ Excluded |

Admins are identified by role stored in the database. New admins are provisioned manually or via an admin group claim in Google Workspace.

---

## ⚙️ Environment Variables

Create a `.env.local` file from `.env.example`:

```env
# Google OAuth (required)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_CALLBACK_URL=

# Database
DATABASE_URL=postgresql://user:password@host:5432/worldcup

# Redis
REDIS_URL=redis://localhost:6379

# JWT
JWT_SECRET=
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d

# football-data.org API
FOOTBALL_DATA_API_KEY=
FOOTBALL_DATA_BASE_URL=https://api.football-data.org/v4

# HiBob API
HIBOB_API_TOKEN=
HIBOB_API_URL=https://api.hibob.com/v1

# Slack
SLACK_WEBHOOK_URL=

# Email (SendGrid)
SENDGRID_API_KEY=
SENDGRID_FROM_EMAIL=worldcup@guesty.com

# App
API_URL=https://your-api.run.app
FRONTEND_URL=https://worldcup.guesty.com
NODE_ENV=production

# Outright Scoring (configurable)
OUTRIGHT_PREDICTION_POINTS=500
SAFE_PICK_SCORES=1-0,0-0,0-1
```

---

## 🛠️ Local Development

### Prerequisites
- Node.js 20 LTS
- PostgreSQL 15 (or Docker)
- Redis (or Docker)

### Setup (Prototype — current branch)

```bash
# Install dependencies
npm install

# Set your Gemini API key (only needed for AI Studio features)
cp .env.example .env.local
# Edit .env.local and set GEMINI_API_KEY

# Run dev server
npm run dev
# → http://localhost:3000
```

### Setup (Production backend — when built)

```bash
# Backend
cd backend/
npm install
npx prisma migrate dev
npm run dev

# Frontend (in another terminal)
npm install
npm run dev
```

---

## 🚢 Deployment

### Frontend — Firebase Hosting

```bash
npm run build
firebase deploy --only hosting
```

### Backend — Google Cloud Run

```bash
docker build -t gcr.io/PROJECT_ID/worldcup-api .
docker push gcr.io/PROJECT_ID/worldcup-api
gcloud run deploy worldcup-api \
  --image gcr.io/PROJECT_ID/worldcup-api \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated
```

---

## 📅 Key Dates

| Milestone | Date |
|---|---|
| Backend complete + deployed | June 8, 2026 |
| Admin UAT (Yeela + Olga) | June 9, 2026 |
| Announcement email sent | June 9, 2026 |
| **Prediction portal opens** | June 9, 2026 |
| **Prediction deadline (global lock)** | June 10, 2026 00:00 UTC |
| **Tournament kicks off** | June 11, 2026 |
| Final match + game ends | ~July 19, 2026 |

---

## 🌍 Supported Sites

Tel Aviv · New York · Kyiv · Barcelona · London · Sydney · San Francisco

---

## 📬 Notifications

| Type | Trigger | Channel |
|---|---|---|
| Announcement | Manual (admin) | Email to all employees |
| Participation reminder | 48h before deadline or manual | Email to non-participants |
| Safe Pick applied | Match kickoff (auto) | Email to affected user |
| Post-match rankings | Match marked FINISHED | Email to all + Slack (global company channel) |

---

## 🔗 External APIs

| API | Purpose | Docs |
|---|---|---|
| [football-data.org](https://www.football-data.org/) | Live scores, fixtures, standings for all 104 matches | [API Docs](https://www.football-data.org/documentation/quickstart) |
| [HiBob](https://apidocs.hibob.com/) | Employee department, site, team, employment status | [API Docs](https://apidocs.hibob.com/) |
| [Slack Incoming Webhooks](https://api.slack.com/messaging/webhooks) | Post match rankings to company Slack channel | [Docs](https://api.slack.com/messaging/webhooks) |

---

## 👤 Contacts

| Role | Name |
|---|---|
| Product Owner | Roni Shif |
| Admin Users | Yeela, Olga + designated admins |

---

*© 2026 Guesty Inc. — Internal use only*
