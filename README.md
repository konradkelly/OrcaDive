# Team Radar

Async standup replacement for small dev teams. See what your team is working on, get AI-suggested status updates from your GitHub activity, and track open PRs — all in real time.

## Monorepo structure

```
team-radar/
├── mobile/                    React Native (Expo) — iOS + Android
│   ├── app/
│   │   ├── _layout.tsx        ← root layout + auth guard
│   │   ├── (auth)/
│   │   │   ├── _layout.tsx
│   │   │   └── login.tsx      ← GitHub OAuth sign-in
│   │   └── (tabs)/
│   │       ├── _layout.tsx
│   │       ├── dashboard.tsx  ← live team feed
│   │       ├── status.tsx     ← post my update (AI pre-fill)
│   │       ├── prs.tsx        ← PR tracker
│   │       └── settings.tsx   ← sign out
│   ├── components/
│   │   ├── TeamMemberCard.tsx
│   │   ├── StatusBadge.tsx    ← reusable PR status pill
│   │   └── PRItem.tsx         ← reusable PR card
│   ├── hooks/
│   │   ├── useTeamSocket.ts   ← WebSocket connection
│   │   ├── useGitHubAuth.ts   ← Expo AuthSession OAuth flow
│   │   └── useStatusSuggestion.ts
│   ├── lib/
│   │   └── api.ts             ← Axios instance + JWT interceptor
│   └── store/
│       ├── authStore.ts       ← Zustand — JWT + SecureStore
│       ├── teamStore.ts       ← Zustand — team members
│       └── prStore.ts         ← Zustand — pull requests
│
└── server/                    Node.js + Express + Socket.io
    ├── src/
    │   ├── index.ts
    │   ├── db/
    │   │   ├── index.ts       ← pg Pool
    │   │   └── schema.sql     ← teams, users, statuses, prs, team_repos
    │   ├── middleware/
    │   │   └── authenticate.ts
    │   ├── routes/
    │   │   ├── auth.ts        ← GitHub OAuth → JWT
    │   │   ├── status.ts      ← GET team / POST update
    │   │   ├── prs.ts         ← GitHub PR polling
    │   │   └── suggest.ts     ← Claude AI suggestions
    │   └── sockets/
    │       └── teamSocket.ts  ← Socket.io room management
    └── tsconfig.json
```

---

## Quickstart

### 1. GitHub OAuth App

Go to https://github.com/settings/developers → New OAuth App:

- **Homepage URL**: `http://localhost:3000`
- **Callback URL**: `teamradar://auth`

Save the Client ID and Client Secret — you'll need them below.

### 2. Server setup

```bash
cd server
cp .env.example .env
# Fill in .env with your values

npm install

# Create the database (requires PostgreSQL running locally)
createdb team_radar
psql team_radar -f src/db/schema.sql

# Start dev server
npm run dev
```

Server runs on http://localhost:3000

### 3. Mobile setup

```bash
cd mobile
npm install

# Install Expo Go on your phone (iOS or Android)
# https://expo.dev/go

npm start
# Scan the QR code with Expo Go
```

For iOS: scan the QR code with the Camera app.
For Android: scan with the Expo Go app.

> **No Xcode or Android Studio needed** to get started. Expo Go handles it.

---

## Environment variables

### server/.env (required)

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string (e.g. `postgresql://localhost:5432/team_radar`) |
| `JWT_SECRET` | Long random string for signing JWTs — generate with `openssl rand -hex 32` |
| `GITHUB_CLIENT_ID` | From your GitHub OAuth App |
| `GITHUB_CLIENT_SECRET` | From your GitHub OAuth App |
| `ANTHROPIC_API_KEY` | From https://console.anthropic.com |
| `PORT` | Server port (default: `3000`) |
| `NODE_ENV` | `development` or `production` |

### mobile/.env (optional)

| Variable | Description |
|---|---|
| `API_URL` | Server URL (default: `http://localhost:3000`) |
| `GITHUB_CLIENT_ID` | Same Client ID as server — public, no secret on device |

---

## Team roles

| Area | Files to own |
|---|---|
| Mobile — Dashboard + UI | `mobile/app/(tabs)/dashboard.tsx`, `components/TeamMemberCard.tsx`, `components/StatusBadge.tsx`, `store/teamStore.ts` |
| Mobile — Status + AI | `mobile/app/(tabs)/status.tsx`, `hooks/useStatusSuggestion.ts` |
| Mobile — Auth + Settings | `mobile/app/(auth)/login.tsx`, `hooks/useGitHubAuth.ts`, `mobile/app/(tabs)/settings.tsx`, `store/authStore.ts` |
| Backend — Auth + DB | `server/src/routes/auth.ts`, `server/src/db/schema.sql`, `server/src/middleware/authenticate.ts` |
| Backend — Status + Sockets | `server/src/routes/status.ts`, `server/src/sockets/teamSocket.ts` |
| Integrations — GitHub + PRs | `server/src/routes/prs.ts`, `mobile/app/(tabs)/prs.tsx`, `components/PRItem.tsx`, `store/prStore.ts` |
| AI Suggestions | `server/src/routes/suggest.ts` |

---

## Key API endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/auth/github` | No | Exchange GitHub OAuth code for JWT |
| `GET` | `/api/status/team` | JWT | Fetch all current team statuses |
| `POST` | `/api/status` | JWT | Post my status update |
| `GET` | `/api/team/prs` | JWT | Fetch open PRs across team repos |
| `POST` | `/api/team/repos` | JWT | Add a repo to track |
| `POST` | `/api/ai/suggest` | JWT | Get AI-generated status from GitHub activity |

WebSocket events:
- `status:updated` — emitted to team room when a member posts an update

WebSocket auth: pass JWT as `socket.handshake.auth.token`

---

## Adding team members

Currently team assignment is manual in the DB. To add someone to a team:

```sql
-- Create a team first
INSERT INTO teams (name) VALUES ('your-team-name') RETURNING id;

-- After a user signs in via GitHub OAuth, assign them:
UPDATE users SET team_id = '<team-uuid>' WHERE username = 'their-github-login';
```

A team invite flow is a good Phase 2 feature.

---

## DB schema

Tables defined in `server/src/db/schema.sql`:

- **teams** — team groups
- **users** — GitHub-authenticated users, linked to a team
- **statuses** — status updates (one per post, latest queried via `LATERAL`)
- **prs** — cached PR records with author linkage (used for `openPRs` count)
- **team_repos** — repos a team is tracking for PR polling
- **latest_statuses** — convenience view (latest status per user)

---

## Phase 2 ideas

- Push notifications when a teammate posts or tags you as a blocker
- Slack integration — post daily radar summary to a channel
- Status history / weekly summary view
- Team invite links (replace manual DB assignment)
- GitHub webhook for real-time PR status updates (vs polling)
- MMKV offline caching layer for mobile
