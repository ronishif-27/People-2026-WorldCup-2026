# Guesty World Cup 2026 — Product Requirements Document

**Version:** 1.0  
**Date:** May 2026  
**Author:** Roni Shif / Guesty People Team  
**Status:** Final — Ready for Development  
**Audience:** Engineering (Frontend + Backend), QA  

---

## Document Purpose

This document defines every user-facing and system-level requirement for the Guesty World Cup 2026 Prediction Portal, organized page by page. Each requirement is written as a User Acceptance Criterion (UAC) the developer can directly test against. Nothing is omitted; every field, state, edge case, and integration is specified.

---

## Global Requirements (All Pages)

> These apply to the entire application and must be met on every page.

| ID | Requirement |
|---|---|
| G-01 | The application must be a responsive web app that works on desktop (≥1024px) and mobile (≥375px) without layout breakage. |
| G-02 | All pages must use Guesty brand colors: Forest Green `#072C23`, Teal `#14665F`, Cream `#F7F5F2`, Salmon `#FA877D`. |
| G-03 | Every API call must be authenticated via a valid JWT Bearer token. Unauthenticated requests return HTTP 401 and redirect the user to the Login page. |
| G-04 | Admins are excluded from the leaderboard and cannot submit predictions. Accessing an admin-only route without the ADMIN role returns HTTP 403. |
| G-05 | All timestamps must be stored and compared in UTC. Display times to users are localized to their browser timezone. |
| G-06 | Prediction locking is enforced server-side. The UI may visually disable inputs, but the server independently rejects any prediction POST after a match's kickoff timestamp. |
| G-07 | Users must accept Terms & Conditions before any prediction can be saved. T&C acceptance is checked on every prediction POST; the API returns HTTP 403 if not accepted. |
| G-08 | All user-submitted inputs must be validated server-side with Zod schemas. Invalid inputs return HTTP 422 with a descriptive error message. |
| G-09 | The application must function correctly for at least 1,000 concurrent users without degraded performance (validated by load test). |
| G-10 | HTTPS must be enforced on all endpoints. HTTP requests must redirect to HTTPS. |
| G-11 | The sidebar navigation is always visible on desktop. On mobile it becomes a slide-out drawer toggled by a hamburger icon. |
| G-12 | The current user's full name, site, and correct-guess count are always visible in the top header bar. |

---

## Page 1 — Login Page

**Route:** `/` (root, before authentication)  
**File (prototype):** `src/components/LoginScreen.tsx`  
**Who sees it:** All unauthenticated visitors  

### Purpose
Gate the application behind Guesty's Google Workspace SSO. Only employees with a valid `@guesty.com` Google account can enter. No manual registration is allowed.

### Requirements

| ID | Requirement |
|---|---|
| L-01 | The page must display the Guesty logo, the headline "World Cup 2026 Prediction Challenge", and a subtitle describing the game. |
| L-02 | A single **"Sign in with Google"** button must initiate a Google OAuth 2.0 redirect to Guesty's Google Workspace. There is no username/password form in production. |
| L-03 | On successful OAuth callback, the backend provisions (creates or updates) a User record with: `email`, `full_name`, `department`, `site` pulled from Google Workspace profile and HiBob data. |
| L-04 | If HiBob returns a `department` or `site` for the user, those values take precedence over any Google profile claims. If HiBob is unreachable, fall back to Google profile claims. |
| L-05 | After login, if the user has never accepted T&C, the backend sets `terms_accepted_at = NULL`. The user is redirected to the Dashboard Hub, where the T&C modal immediately overlays. |
| L-06 | After login, if the user has previously accepted T&C, they are routed directly to the Dashboard Hub with no modal shown. |
| L-07 | Admin users (identified by `role = ADMIN` in DB) are routed to the Dashboard Hub with the Admin nav item visible in the sidebar. |
| L-08 | Terminated employees (HiBob `employment_status = INACTIVE`) must be denied access. The OAuth callback must reject provisioning for inactive employees and display: *"Your Guesty account is no longer active."* |
| L-09 | The backend issues a signed JWT access token (15-minute expiry) on successful login. A refresh token is stored in an `httpOnly; Secure; SameSite=Strict` cookie. The access token is stored in memory (not localStorage). |
| L-10 | Rate limiting: a maximum of 10 login attempts per IP per minute. Excess requests return HTTP 429. |
| L-11 | The login page must include a decorative animated background (soccer field grid, brand-colored blur glow) matching the prototype visual design. |
| L-12 | If the OAuth provider returns an error or the user cancels, display an inline error message: *"Sign-in was cancelled. Please try again."* |

---

## Page 2 — Onboarding / Terms & Conditions Modal

**Route:** Overlays the Dashboard Hub on first login  
**File (prototype):** `src/components/Onboarding.tsx`  
**Who sees it:** All users on their first login, before any prediction can be saved  

### Purpose
Explain game rules to first-time users and collect Terms & Conditions acceptance. The modal is mandatory — users cannot interact with any other part of the app until they complete it.

### Requirements

#### Phase 1 — Welcome Screen

| ID | Requirement |
|---|---|
| OB-01 | The modal must render as a full-screen overlay with a dark, blurred backdrop. The user cannot dismiss it by clicking outside or pressing Escape. |
| OB-02 | Phase 1 displays the Guesty World Cup 2026 title and three game rules: (1) Predict Exact Scores, (2) Observe the Lockout Deadline, (3) Climb the Global Board. Each rule has an icon, title, and description matching the prototype copy. |
| OB-03 | A **"Start Now"** button advances to Phase 2 (Betting Rules). |

#### Phase 2 — Betting Rules

| ID | Requirement |
|---|---|
| OB-04 | Phase 2 is a 3-step card slider. Steps: (1) Point Multipliers, (2) First Goal Specials, (3) Inter-Office Rivalry. Users can navigate with Next / Back buttons and by clicking the pagination dots. |
| OB-05 | Step 1 copy must explain: exact score = 100 pts; correct winner = 40 pts; wrong outcome = 0 pts; first goal range = +25 pts bonus. |
| OB-06 | Step 2 copy must explain the first-goal time range system (per-match, not tournament-wide). |
| OB-07 | Step 3 copy must explain how individual scores feed into department and site leaderboard standings. |

#### Terms & Conditions Gate

| ID | Requirement |
|---|---|
| OB-08 | Before the **"Let's Begin!"** button becomes active on Step 3, a T&C checkbox must be displayed: *"I agree to the Guesty World Cup 2026 Terms & Conditions [link]."* The button is disabled until the checkbox is ticked. |
| OB-09 | On clicking "Let's Begin!", the frontend calls `POST /users/terms`. The backend records `terms_accepted_at` (UTC timestamp), `ip_address`, and `terms_version = 1` in the `TermsAcceptance` table. |
| OB-10 | If the API call to accept T&C fails, display an inline error and keep the modal open. Do not allow the user past the modal without a confirmed server-side acceptance. |
| OB-11 | On successful T&C acceptance, dismiss the modal with a confetti burst and take the user to the Dashboard Hub. |
| OB-12 | The modal stores completion in the database (`user.terms_accepted_at`), not just localStorage. Clearing browser storage must NOT reset the T&C gate for a returning user. |
| OB-13 | Admins are also required to accept T&C on first login. |

---

## Page 3 — Dashboard Hub

**Route:** `/dashboard` (default post-login view)  
**File (prototype):** `App.tsx` — Dashboard tab  
**Who sees it:** All authenticated users (users + admins, after T&C acceptance)  

### Purpose
Provide an at-a-glance overview of the user's personal stats, current match status, live activity from colleagues, and a summary of the leaderboard standings.

### Requirements

#### Countdown Clock

| ID | Requirement |
|---|---|
| D-01 | The `CountdownClock` component must appear at the top of every page (not just Dashboard) and count down to the global prediction deadline: **June 10, 2026 00:00:00 UTC**. |
| D-02 | The clock displays Days, Hours, Minutes, Seconds in a styled scoreboard format. |
| D-03 | When the countdown reaches zero, the clock banner turns red and displays: *"Predictions Are Locked."* The banner persists on all pages until the tournament ends. |
| D-04 | The clock's deadline is enforced server-side. The visual countdown is informational only; the backend's per-match kickoff timestamps govern actual locking. |

#### Stats Cards

| ID | Requirement |
|---|---|
| D-05 | Three stats cards are displayed: **My Placed Bets** (count of prediction records for the current user), **My Saved Outrights** (count of non-empty outright fields), **My Correct Guesses** (count of FINISHED matches where the user scored >0 points). |
| D-06 | All card values are computed server-side (`GET /users/:id/stats`) and updated on page load and after each match is marked FINISHED. |

#### Live Activity Feed

| ID | Requirement |
|---|---|
| D-07 | A dark-themed activity ticker displays the 5 most recent real-time events from colleagues: predictions submitted, points earned, ranking changes. |
| D-08 | The feed is powered by a WebSocket event (`activity:feed`) pushed from the server. New events animate in from the top and push older events down. The ticker is real data in production — no simulation. |

#### Initial Matches Preview

| ID | Requirement |
|---|---|
| D-09 | The Dashboard shows the first 4 upcoming matches from the match list in a compact card layout. Each card shows: teams + flags, date, venue, the user's saved prediction (if any), and a "Predict" button (or "Locked" if the match is locked). |
| D-10 | Clicking "Predict" navigates the user to the Predictions page, scrolled to that match. |
| D-11 | Clicking "Show All Matches →" navigates to the Predictions page. |

#### Top Predictors Mini-Leaderboard

| ID | Requirement |
|---|---|
| D-12 | A mini-leaderboard shows the top 4 ranked employees (by total points). Each entry shows: rank medal (🥇🥈🥉/number), avatar initials, full name, department, site, and points. |
| D-13 | The current logged-in user is highlighted in Guesty Teal with a "YOU" badge. |
| D-14 | A "See All Standings" button navigates to the full Leaderboard page. |
| D-15 | Mini-leaderboard data is fetched from `GET /leaderboard?limit=4`. It updates in real time via the `leaderboard:updated` WebSocket event. |

---

## Page 4 — Predictions Page

**Route:** `/predictions`  
**File (prototype):** `src/components/MatchPredictor.tsx`  
**Who sees it:** Authenticated non-admin users (admins see the page but cannot submit predictions)  

### Purpose
Allow users to browse all known upcoming matches, submit or modify score predictions for each, and set outright tournament-wide special predictions. This is the core game interaction.

### General Rules

| ID | Requirement |
|---|---|
| P-01 | Users can submit or modify predictions for any UPCOMING or LIVE match whose kickoff timestamp has not yet passed. |
| P-02 | Once a match's kickoff timestamp has passed, all inputs for that match are disabled and display "Locked." The server independently rejects prediction POSTs after kickoff. |
| P-03 | Users can modify their prediction for an UPCOMING match any number of times before lockout. Each save replaces the prior prediction. After the deadline, predictions are immutable. |
| P-04 | Before the current user has submitted a prediction for a match, they can see only their own input area. After submitting, they can also see how many other users submitted (aggregate count only — not individual predictions) until the match is FINISHED. |
| P-05 | Once a match is FINISHED, all participants' individual predictions for that match are revealed to everyone (name, predicted score). |
| P-06 | Late joiners (users who registered after the tournament started) can predict on any match that has not yet kicked off. They receive no penalty for earlier missed matches — those are simply scored as 0 pts. |
| P-07 | Admins cannot see the prediction input UI. They see the match list in read-only mode and a note: *"Admins do not participate in predictions."* |

#### Outright Tournament Predictions (Bonus Specials)

| ID | Requirement |
|---|---|
| P-08 | At the top of the Predictions page, three optional "Bonus Specials" inputs are displayed: **Top Scorer (Golden Boot)** (text input, player name), **Team with Most Red Cards** (text input, country name), **Total Headed Goals** (numeric stepper, whole number ≥ 0). |
| P-09 | A fourth outright — **Time of First Tournament Goal** (time range selector matching the first-goal picker UX) — is also displayed if the tournament has not yet started. |
| P-10 | Outright predictions can be saved independently of match predictions via `POST /predictions/outrights`. They are locked at the global June 10 deadline (same as the countdown clock). |
| P-11 | After the tournament ends, correct outright predictions award bonus points (configurable constant, default stored in `OUTRIGHT_PREDICTION_POINTS` env var). Scoring is applied by the admin when marking outright results. |
| P-12 | A "Save Special Predictions" button triggers a save with a confetti burst and a success toast. |
| P-13 | All outright input fields are disabled after the June 10 deadline with a "Locked" state. |

#### Match Prediction Cards

| ID | Requirement |
|---|---|
| P-14 | Every match known to the system is displayed as a card, sorted by kickoff timestamp (ascending). Matches are grouped by stage: Group Stage, Round of 32, Round of 16, Quarterfinals, Semifinals, Final. |
| P-15 | Each match card shows: stage label, coin value (🪙 250–2000 depending on stage), team A name + flag, team B name + flag, kickoff date + time, venue, city. |
| P-16 | For LIVE matches, the card prominently shows a red "LIVE" badge with the current minute (e.g., `74'`). The actual live score is fetched from the football-data.org API and displayed inside the card. |
| P-17 | For FINISHED matches, the final score is displayed and the prediction input is locked. The user's prediction is shown alongside the actual score with a colour-coded result indicator: green (correct), amber (winner only), red (miss). |
| P-18 | Each UPCOMING card shows a "Guesty Consensus Forecast" bar chart representing the percentage of users who predicted Team A win / Draw / Team B win. This data is fetched from `GET /predictions/:matchId/consensus` (aggregate only; does not reveal individual predictions). |
| P-19 | Each match card shows the estimated coin reward for a correct prediction (`getMatchCoinsValue(match)` based on stage). |
| P-20 | The match card displays an "Est. odds index" multiplier for informational display only (not used in actual scoring). |

#### Score Input UX

| ID | Requirement |
|---|---|
| P-21 | Clicking "Predict Score" on an UPCOMING match opens an inline editing form within the card. The form shows two `SmartGoalSelector` steppers (one per team), a first-goal time range picker, and a "Save Forecast" button. |
| P-22 | The `SmartGoalSelector` component allows increment/decrement with ± buttons and direct number input. The minimum value is 0. The maximum value is 20 (edge case guard). |
| P-23 | The first-goal time range picker displays 6 selectable buckets: `1–15'`, `16–30'`, `31–45'`, `46–60'`, `61–75'`, `76–90+'`. Selecting a bucket highlights it. The selection is optional. |
| P-24 | Clicking "Save Forecast" calls `POST /predictions` with `{ matchId, scoreA, scoreB, firstGoalRange }`. On success, a confetti burst plays and a green toast displays the saved score. |
| P-25 | If a user has an existing prediction, the "Predict Score" button is labelled "Modify Goal Prediction" and pre-fills the form with the saved values. |
| P-26 | If the match is locked when the user clicks save, the server returns HTTP 423 and the UI displays: *"This match has already kicked off. Predictions are locked."* |

#### Live Score Integration (football-data.org)

| ID | Requirement |
|---|---|
| P-27 | The backend polls football-data.org's Matches API at a configurable interval (default every 60 seconds during match windows) to get live and final scores. |
| P-28 | When a live score update is received, the backend broadcasts a `match:score_updated` WebSocket event with `{ matchId, scoreA, scoreB, status, minute }`. |
| P-29 | When football-data.org reports a match as FINISHED (FT status), the backend automatically transitions `match.status` to FINISHED, triggers the scoring engine, and broadcasts `match:finished`. |
| P-30 | Matches where teams are not yet determined (e.g., Knockout bracket TBD) are stored with placeholder team names (e.g., "Winner Group A") and are hidden from the predictions page until both teams are confirmed. |
| P-31 | The backend seeds the initial 48 Group Stage matches from football-data.org on first run. Knockout bracket matches are added dynamically as they are confirmed by FIFA and returned by the API. |

---

## Page 5 — Leaderboard Page

**Route:** `/leaderboard`  
**File (prototype):** `src/components/Leaderboard.tsx`  
**Who sees it:** All authenticated users (users + admins)  

### Purpose
Display the global, real-time ranked standings for all participating employees. Allow filtering by department and site to encourage inter-team competition.

### Requirements

| ID | Requirement |
|---|---|
| LB-01 | The leaderboard is ranked by total points (descending). Ties are broken by most correct exact-score predictions, then alphabetically by full name. |
| LB-02 | Admins do not appear in the leaderboard. Safe Pick predictions count in the ranking unless the user has never submitted any real prediction (has_participated = false). |
| LB-03 | The leaderboard displays all participating users by default (no filter). Columns: Rank, Employee Name + Avatar, Department, Site, Coins Balance. |
| LB-04 | Rank 1 displays 🥇, Rank 2 displays 🥈, Rank 3 displays 🥉. All other ranks display numeric values. |
| LB-05 | The logged-in user's row is highlighted in Guesty Teal with a left border and a "YOU" badge. |
| LB-06 | A search input allows users to search by employee name, department, or site. Results filter in real-time without a backend call. |
| LB-07 | A **Department** dropdown filters the leaderboard to show only employees in the selected department. Options are dynamically populated from the current leaderboard data. |
| LB-08 | A **Site** dropdown filters the leaderboard to show only employees at the selected office location. Options are dynamically populated from the current data. |
| LB-09 | Department and site filters can be combined (e.g., Engineering at Tel Aviv). |
| LB-10 | Leaderboard data is fetched from `GET /leaderboard` (paginated; default page size 50). The response includes each user's global rank (not relative to filter). |
| LB-11 | The leaderboard updates in real time via the `leaderboard:updated` WebSocket event. When an update arrives, affected rows animate to their new rank with a smooth transition. |
| LB-12 | Each employee row shows: exact correct predictions count and outcome-only correct predictions count (e.g., "4 Exact • 7 Outcome"). These are computed server-side. |
| LB-13 | A live activity feed ticker (same as Dashboard) is displayed above the leaderboard table. |
| LB-14 | The leaderboard is paginated. A "Load More" button or infinite scroll fetches additional pages from `GET /leaderboard?page=N`. |

---

## Page 6 — Rules Page ("How to Play")

**Route:** `/rules`  
**File (prototype):** `App.tsx` — Rules tab  
**Who sees it:** All authenticated users  

### Purpose
Static reference page explaining the game rules, scoring system, and deadlines. No interaction required.

### Requirements

| ID | Requirement |
|---|---|
| R-01 | The page displays three rule cards: (1) Predict Exact Goals, (2) First Goal Range, (3) June 10th Hard Lock. |
| R-02 | A "Points Award System Tiers" section lists all scoring outcomes: Exact Score (+100 pts), Correct Outcome (+40 pts), Wrong Forecast (0 pts), First Goal Bonus (+25 pts), Outright Bonus (configurable — displayed as "TBD" until confirmed). |
| R-03 | A coin value table shows stage multipliers: Group Stage 🪙 250, Round of 32 🪙 350, Round of 16 🪙 450, Quarterfinals 🪙 500, Semifinals 🪙 1000, Final 🪙 2000. |
| R-04 | An FAQ section answers common questions (at minimum: "Can I change my prediction after saving?" and "What happens if I miss submitting a prediction?"). |
| R-05 | The Rules page is accessible before and after predictions are locked. Its content does not change based on lock state. |

---

## Page 7 — Admin Control Center

**Route:** `/admin`  
**File (prototype):** `src/components/AdminPanel.tsx`  
**Who sees it:** Admin role only. Non-admins who navigate to this route are redirected to Dashboard with no error message visible. The Admin nav item is hidden in the sidebar for non-admins.  

### Purpose
Allow designated admins to manage the full lifecycle of the tournament: add and update matches, enter live and final scores, trigger notifications, view participation stats, manage prediction locks, and export data.

### Sub-tab 1 — Scoreboard Manager (Match List)

| ID | Requirement |
|---|---|
| A-01 | Displays all matches in the system as an editable list, sorted by kickoff timestamp. Each row shows: team flags, team names, status badge (UPCOMING / LIVE / FINISHED), kickoff date, venue, city, and current score (if LIVE or FINISHED). |
| A-02 | Clicking the Edit (pencil) icon for a match opens an inline edit form with: score input for Team A, score input for Team B, status selector (UPCOMING / LIVE / FINISHED), and a live match minute input (visible only when status = LIVE). |
| A-03 | Saving a match edit calls `PATCH /matches/:id`. The backend validates the inputs, updates the DB, and broadcasts the appropriate WebSocket event (`match:score_updated` if LIVE, `match:finished` if FINISHED). |
| A-04 | When a match is saved as FINISHED, the backend immediately runs the scoring engine for all predictions on that match, populates the Score table, and triggers a leaderboard recalculation. |
| A-05 | A global **Force-Lock Predictions** button at the top of the panel immediately locks all UPCOMING matches and rejects any new prediction POSTs. This is a manual override for emergencies. The button becomes red and reads "Predictions are Force-Locked" when active. Clicking again unlocks. |
| A-06 | Admin can lock a single match individually via a "Lock This Match" button per row, regardless of its kickoff timestamp. |

### Sub-tab 2 — Add Custom Match Card

| ID | Requirement |
|---|---|
| A-07 | A form allows admins to manually add a new match with fields: Team A name, Team B name, Flag Emoji A, Flag Emoji B, Venue, City, Kickoff Date, Kickoff Time, Stage (Group Stage / Round of 32 / Round of 16 / Quarterfinals / Semifinals / Final), initial Status. |
| A-08 | On submit, calls `POST /matches`. The new match immediately appears in the Scoreboard Manager list and on the Predictions page for all users. |
| A-09 | The kickoff timestamp stored in the DB must be a full UTC datetime. The admin's local time input must be converted to UTC using the server's timezone handling. |
| A-10 | All fields except Flag Emoji (defaults to 🏳️) are required. Form validation shows inline error messages. |

### Sub-tab 3 — Participation & Statistics

| ID | Requirement |
|---|---|
| A-11 | Displays a participation summary table: every Guesty employee fetched from HiBob, with columns: Full Name, Department, Site, Login Status (Logged In / Never Logged In), Predictions Submitted (count), Last Active. |
| A-12 | The table is sortable by any column and searchable by name. |
| A-13 | A summary header shows: Total Employees, Employees Logged In, Employees who Submitted ≥1 Prediction, Employees Never Logged In. |
| A-14 | A **"Send Reminder Email"** button triggers `POST /admin/notify/reminder`, which queues reminder emails to all users who have never logged in or submitted zero predictions. The button is disabled with a 10-minute cooldown after each send. |
| A-15 | A **"Send Rankings to Slack"** button triggers `POST /admin/notify/rankings`, which posts the current leaderboard summary to the configured global Slack channel. |
| A-16 | A **"Download Leaderboard CSV"** button triggers `GET /admin/export/csv` and downloads a file named `Guesty_WorldCup_Leaderboard_YYYY-MM-DD.csv` with columns: Rank, Full Name, Department, Site, Total Points, Exact Correct, Winner Correct, Matches Predicted. |

---

## System Feature — Safe Pick

**Trigger:** Automated server job at each match's kickoff timestamp  
**Not a visible page** — background system behavior  

| ID | Requirement |
|---|---|
| SP-01 | At each match's kickoff timestamp, a BullMQ job fires for every user who: (a) has at least one Prediction record in any prior match (`has_participated = true`), AND (b) has no Prediction record for the current match. |
| SP-02 | For each eligible user, the system auto-inserts a Prediction with `is_safe_pick = true` and a fallback score that cycles through the sequence: 1-0, 0-0, 0-1 (rotating per match ID modulo 3). |
| SP-03 | Users who have NEVER logged in or submitted any prediction (`has_participated = false`) do NOT receive Safe Picks. Safe Picks are a fairness mechanism for active participants who missed one match, not an onboarding shortcut. |
| SP-04 | After a Safe Pick is applied, the system sends an individual email to the user: *"We noticed you missed the prediction deadline for [Match A vs Match B]. A Safe Pick score of [score] was automatically applied on your behalf."* |
| SP-05 | The `is_safe_pick = true` flag is visible to admins in the Participation Statistics panel so they can distinguish genuine predictions from auto-fills. |
| SP-06 | Safe Pick predictions are scored using the same scoring rules as user-submitted predictions. If the auto-filled score happens to be correct, the user earns the points. |

---

## System Feature — HiBob Integration

**Not a visible page** — background sync  

| ID | Requirement |
|---|---|
| BOB-01 | On each user's first login via Google OAuth, the backend calls the HiBob REST API to fetch: `department`, `site` (office location), `displayName`, `employmentStatus`. |
| BOB-02 | A daily sync job (BullMQ, runs at 02:00 UTC) re-fetches all employee records from HiBob and updates the User table. Changes in department or site are applied. |
| BOB-03 | Employees whose HiBob `employmentStatus` becomes INACTIVE during the tournament are soft-deleted from the leaderboard (excluded from rankings and notifications) but their historical prediction data is retained. |
| BOB-04 | If the HiBob API is unavailable at first login, the user is provisioned using Google Workspace claims (name, email) with `department = "Unknown"` and `site = "Unknown"`. The admin is notified via Slack so they can manually correct the record. |
| BOB-05 | The HiBob sync job results (records updated, errors) are logged to Cloud Logging for admin review. |

---

## System Feature — Notification System

**Not a visible page** — background jobs  

### Email Notifications (SendGrid)

| ID | Requirement |
|---|---|
| N-01 | **Announcement Email:** Sent manually by admin via `POST /admin/notify/reminder` (triggered by a button in the Admin panel). Subject: *"⚽ Guesty World Cup 2026 — Make Your Predictions Now!"* Body includes the portal URL, deadline (June 10), and a brief rules summary. Recipients: all Guesty employees (from HiBob list). |
| N-02 | **Participation Reminder Email:** Sent to users who have never logged in or submitted zero predictions. Triggered manually by admin or automatically at 48 hours before the global deadline. Subject: *"Last chance — predict before June 10!"* |
| N-03 | **Post-Match Rankings Email:** Sent automatically when a match is marked FINISHED. Subject: *"[Team A] [score] [Team B] — See How You Ranked!"* Body includes the user's current rank, their score for that match, top 10 global standings, and their department's ranking. Recipients: all users who submitted at least one prediction. |
| N-04 | **Safe Pick Applied Email:** Sent individually to each user when a Safe Pick is auto-applied. Includes the match name, the auto-fill score, and a note explaining the Safe Pick system. |
| N-05 | All emails use Guesty brand colours and logo. HTML templates must be created for each type. |
| N-06 | All sent notifications are logged in the `Notification` table with status (queued / sent / failed) and timestamps. |
| N-07 | Failed email deliveries are retried up to 3 times with exponential backoff via BullMQ. |

### Slack Notifications

| ID | Requirement |
|---|---|
| N-08 | After each match is marked FINISHED and scoring is complete, the system posts a message to the configured global Slack company channel via Incoming Webhook. |
| N-09 | The Slack message format must include: Match name + final score, Top 5 global leaderboard standings (name, points), Department standings summary (department name → average score), a direct link to the portal. |
| N-10 | Slack posts can also be triggered manually by admins via the "Send Rankings to Slack" button in the Admin panel. |
| N-11 | The Slack webhook URL is stored in the `SLACK_WEBHOOK_URL` environment variable. The channel name is determined by the webhook configuration (not set in code). |

---

## System Feature — Real-Time WebSocket Events

**Server → Client push events (Socket.IO)**  

| Event | Payload | When |
|---|---|---|
| `match:score_updated` | `{ matchId, scoreA, scoreB, status, minute }` | Whenever the backend receives an updated live score from football-data.org |
| `match:locked` | `{ matchId }` | When a match's kickoff timestamp is reached (BullMQ job) or admin force-locks |
| `match:finished` | `{ matchId, scoreA, scoreB }` | When admin saves a match as FINISHED |
| `leaderboard:updated` | `{ top10: [...], myRank, myPoints }` | After scoring engine runs for any FINISHED match |
| `prediction:safe_pick_applied` | `{ matchId, scoreA, scoreB }` | When a Safe Pick is auto-applied for the connected user |
| `activity:feed` | `{ userName, action, department, site, points }` | On any significant user action (prediction saved, points earned, rank changed) |

| ID | Requirement |
|---|---|
| WS-01 | All WebSocket connections must be authenticated. The client sends the JWT access token during the Socket.IO handshake. Unauthenticated connections are rejected. |
| WS-02 | The client subscribes to all events on connect and unsubscribes on disconnect. |
| WS-03 | On receiving `leaderboard:updated`, the Leaderboard page and Dashboard mini-leaderboard must animate rows to their new positions without a full page reload. |
| WS-04 | On receiving `match:locked`, the Predictions page must immediately disable inputs for that match without a page reload. |
| WS-05 | On receiving `match:finished`, the match card updates to show the final score and unlocks the "See Other Predictions" view. |

---

## System Feature — football-data.org API Integration

| ID | Requirement |
|---|---|
| FD-01 | The backend integrates with [football-data.org v4 API](https://www.football-data.org/documentation/quickstart) using an API key stored in `FOOTBALL_DATA_API_KEY`. |
| FD-02 | On initial setup, the backend seeds all 48 Group Stage matches from the `/v4/competitions/WC/matches` endpoint, storing kickoff times in UTC. |
| FD-03 | During the tournament, a polling job runs every 60 seconds for any match with status LIVE or within 30 minutes of kickoff. It fetches live score updates from the API and broadcasts `match:score_updated` events. |
| FD-04 | When the API returns a match status of `FINISHED`, the backend transitions the match status, runs the scoring engine, and broadcasts `match:finished`. The admin can also manually mark a match as FINISHED to override. |
| FD-05 | Knockout matches (Round of 32 onward) are synced from the API as soon as the bracket is determined. They are hidden from the Predictions page until both team names are confirmed (i.e., not "Winner Group X"). |
| FD-06 | The football-data.org API free tier allows 10 requests/minute. The polling job must respect this limit with a rate limiter. If the limit is exceeded, the job backs off and logs a warning. |
| FD-07 | If football-data.org is unavailable for >5 minutes during a live match, admins are notified via Slack so they can manually enter scores in the Admin panel. |

---

## Appendix A — Navigation Structure

```
[Sidebar]
├── Dashboard Hub           → /dashboard
├── Place Predictions       → /predictions
├── Live Leaderboard        → /leaderboard
├── How to Play             → /rules
└── Admin Control Center    → /admin  ← ADMIN ONLY (hidden for users)

[Header Bar — always visible]
├── Page title
├── Correct Guess count badge
├── User name + PRO badge
└── Avatar initials

[Sidebar Footer]
├── Correct Wins counter
├── Sign Out
└── Restart Onboarding
```

---

## Appendix B — User Flows

### Flow 1: First-Time User Login
```
Visit site → Login page → Click "Sign in with Google" →
Google OAuth redirect → Backend provisions user via HiBob → JWT issued →
T&C modal (Onboarding Phase 1 + Phase 2 + T&C checkbox) →
Accept T&C (server writes record) → Confetti → Dashboard Hub
```

### Flow 2: Returning User Login
```
Visit site → Login page → Click "Sign in with Google" →
Google OAuth redirect → JWT issued (T&C already accepted) → Dashboard Hub
```

### Flow 3: Submitting a Prediction
```
Go to Predictions → Find match card → Click "Predict Score" →
Set goals for Team A and Team B with SmartGoalSelector →
Select first-goal time range (optional) → Click "Save Forecast" →
Server validates: (a) match not locked, (b) user T&C accepted →
Server saves prediction → Confetti + toast → Card updates to show saved score
```

### Flow 4: Match Kicks Off (Automated)
```
Match kickoff timestamp reached → BullMQ job fires →
match.status → LOCKED → WebSocket: match:locked broadcast →
All connected clients: prediction inputs disabled for that match →
[for eligible users with no prediction] → Safe Pick applied → Email sent
```

### Flow 5: Admin Enters Final Score
```
Admin → Admin Control Center → Scoreboard Manager →
Find match → Click Edit → Change status to FINISHED, enter scoreA + scoreB → Save →
Server: scoring engine runs for all predictions on match →
Score table populated → leaderboard recalculated →
WebSocket: leaderboard:updated + match:finished broadcast →
Email: post-match rankings sent to all participants →
Slack: rankings summary posted to global company channel
```

---

## Appendix C — API Endpoint Reference

```
# Auth
GET  /auth/google           Initiate Google OAuth 2.0 redirect
GET  /auth/callback         OAuth callback; issues JWT + provisions user
POST /auth/logout           Invalidate session
GET  /auth/me               Current user profile + T&C status

# Users
POST /users/terms           Accept T&C
GET  /users/:id/stats       Points, rank, correct guesses for a user
GET  /users                 All users [ADMIN ONLY]

# Matches
GET  /matches               All matches (status, scores, kickoff time)
GET  /matches/:id           Single match details
POST /matches               Create a new match [ADMIN ONLY]
PATCH /matches/:id          Update score, status, stage [ADMIN ONLY]
POST /matches/:id/lock      Force-lock a specific match [ADMIN ONLY]

# Predictions
POST /predictions           Submit or update a prediction (rejected if locked)
GET  /predictions/me        All predictions by current user
GET  /predictions/:matchId/all     All predictions for a match (only after user has submitted)
GET  /predictions/:matchId/consensus  Aggregate win/draw/loss percentages
POST /predictions/outrights Submit outright tournament predictions
GET  /predictions/outrights/me    Current user's outright predictions

# Leaderboard
GET  /leaderboard           Global rankings (paginated, filterable by dept/site)
GET  /leaderboard/department/:dept  Rankings for a department
GET  /leaderboard/site/:site        Rankings for an office site
GET  /leaderboard/me               Current user's rank + surrounding neighbors

# Admin
GET  /admin/participation         Who has logged in, voted, or not participated
POST /admin/notify/reminder       Queue reminder emails to non-participants
POST /admin/notify/rankings       Post ranking summary to Slack
POST /admin/lock-all              Force-lock all open predictions globally
GET  /admin/export/csv            Download leaderboard as CSV
```

---

## Appendix D — Open Items / Decisions Required Before Development

| # | Decision | Owner | Priority |
|---|---|---|---|
| 1 | football-data.org API key provisioned and rate limits confirmed | IT / Roni | **Before Sprint 1** |
| 2 | HiBob API token and available fields confirmed | HR / IT | **Before Sprint 1** |
| 3 | Google Workspace OAuth client ID registered for the app domain | IT | **Before Sprint 1** |
| 4 | Admin email list finalized (Yeela + Olga + any others) | Roni | Sprint 1 |
| 5 | Outright prediction scoring point values decided | Roni / Product | Sprint 1 |
| 6 | Terms & Conditions legal text reviewed and approved | Legal / HR | Pre-launch |
| 7 | Slack webhook URL provisioned for global company channel | IT / Comms | Sprint 2 |
| 8 | SendGrid account and sender domain configured | IT / Marketing | Sprint 2 |
| 9 | Cloud Run project and service account permissions set up | Infra | **Before Sprint 1** |
| 10 | Cloud SQL instance provisioned | Infra | **Before Sprint 1** |

---

*End of Document — Guesty World Cup 2026 PRD v1.0*
