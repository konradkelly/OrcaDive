# OrcaDive

Async standup replacement for small dev teams. See what your team — humans and AI agents — is working on, get AI-suggested status updates from your GitHub activity, track open PRs, and orchestrate agent tasks — all in real time.

## Monorepo structure

```
orca-dive/
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
│   │       ├── agents.tsx     ← agent list + detail + task assignment
│   │       └── settings.tsx   ← sign out
│   ├── components/
│   │   ├── TeamMemberCard.tsx
│   │   ├── StatusBadge.tsx    ← reusable PR status pill
│   │   ├── PRItem.tsx         ← reusable PR card
│   │   └── AgentCard.tsx      ← AI agent card (full + compact)
│   ├── hooks/
│   │   ├── useTeamSocket.ts   ← STOMP WebSocket connection + agent events
│   │   ├── useGitHubAuth.ts   ← Expo AuthSession OAuth flow
│   │   └── useStatusSuggestion.ts
│   ├── lib/
│   │   └── api.ts             ← Axios instance + JWT interceptor
│   └── store/
│       ├── authStore.ts       ← Zustand — JWT + SecureStore
│       ├── teamStore.ts       ← Zustand — team members
│       ├── prStore.ts         ← Zustand — pull requests
│       └── agentStore.ts     ← Zustand — AI agents + runs
│
└── server/                    Spring Boot + Kotlin
    ├── build.gradle.kts       ← Gradle Kotlin DSL build config
    ├── settings.gradle.kts
    ├── gradle.properties      ← JDK path config
    └── src/main/
        ├── kotlin/com/orcadive/
        │   ├── Application.kt         ← Spring Boot entry point
        │   ├── db/
        │   │   ├── Tables.kt          ← Exposed ORM table definitions
        │   │   └── DatabaseConfig.kt  ← DataSource + Exposed wiring
        │   ├── security/
        │   │   ├── JwtUtil.kt              ← JWT sign/verify (jjwt)
        │   │   ├── JwtAuthenticationFilter.kt
        │   │   ├── AgentApiKeyFilter.kt    ← API key auth for agent webhooks
        │   │   ├── SecurityConfig.kt       ← Spring Security config
        │   │   ├── UserPrincipal.kt
        │   │   ├── AgentPrincipal.kt
        │   │   └── SecurityExtensions.kt
        │   ├── dto/
        │   │   ├── Requests.kt         ← request data classes
        │   │   └── Responses.kt        ← response data classes
        │   ├── service/
        │   │   ├── GitHubService.kt    ← OAuth + PR fetch via WebClient
        │   │   └── ClaudeService.kt    ← Anthropic API via WebClient
        │   ├── controller/
        │   │   ├── AuthController.kt           ← GitHub OAuth → JWT
        │   │   ├── StatusController.kt         ← GET team / POST update
        │   │   ├── PrController.kt             ← GitHub PR polling
        │   │   ├── SuggestController.kt        ← Claude AI suggestions
        │   │   ├── AgentController.kt          ← agent CRUD + task assignment
        │   │   └── AgentWebhookController.kt   ← agent self-report endpoints
        │   └── websocket/
        │       ├── WebSocketConfig.kt          ← STOMP broker config
        │       └── StompAuthInterceptor.kt     ← JWT auth on STOMP CONNECT
        └── resources/
            ├── application.yml    ← Spring config (DB, secrets, ports)
            └── schema.sql         ← PostgreSQL schema
```

---

## Quickstart

### 1. GitHub OAuth App

Go to https://github.com/settings/developers → New OAuth App:

- **Homepage URL**: `http://localhost:3000` (or your product URL)
- **Authorization callback URL**: Must match the redirect URI the app uses (default: `orcadive://auth` for dev builds). In **Expo Go**, the URI is often `exp://…` — check the Metro console for `[GitHub OAuth] Add this exact URL…` and register **that** URL on the OAuth app (you can add multiple callback URLs).
- **Device authorization** is not required; sign-in uses the browser **authorization code** flow with PKCE.

Save the Client ID and Client Secret — you'll need them below.

### 2. Environment variables

Create a `.env` file in the **project root**:

```env
GITHUB_CLIENT_ID=your_client_id
GITHUB_CLIENT_SECRET=your_client_secret
JWT_SECRET=your_jwt_secret
ANTHROPIC_API_KEY=your_key
DATABASE_URL=jdbc:postgresql://localhost:5432/orcadive?user=orcadive&password=orcadive
```

Create a `.env` file in `mobile/`:

```env
API_URL=http://<your-pc-ip>:3000
GITHUB_CLIENT_ID=your_client_id
```

### 3. Server setup (Docker Compose — recommended)

Requires **Docker** with Docker Compose.

```bash
docker compose up --build -d
```

This starts PostgreSQL 16 and the Spring Boot server on port 3000. The database schema is automatically applied on first run.

To view server logs:

```bash
docker logs orcadive-server-1 -f
```

To rebuild after code changes:

```bash
docker compose up --build -d
```

### Server setup (manual)

Requires **JDK 17+** and **PostgreSQL** running locally.

```bash
cd server

# Create the database
createdb orcadive
psql orcadive -f src/main/resources/schema.sql

# Set environment variables (or source your .env)
export DATABASE_URL=jdbc:postgresql://localhost:5432/orcadive
export JWT_SECRET=$(openssl rand -hex 32)
export GITHUB_CLIENT_ID=your_client_id
export GITHUB_CLIENT_SECRET=your_client_secret
export ANTHROPIC_API_KEY=your_key

# Build and run
./gradlew bootRun     # macOS/Linux
gradlew.bat bootRun   # Windows
```

Server runs on http://localhost:3000

### 4. Mobile setup

```bash
cd mobile
npm install --legacy-peer-deps

# Install Expo Go on your phone (iOS or Android)
# https://expo.dev/go

npx expo start --tunnel
# Scan the QR code with Expo Go
```

> **Note:** `--tunnel` mode is required when your phone is not on the same network, or when localhost resolution fails. It requires an Expo account (`npx expo login`).

For iOS: scan the QR code with the Camera app.
For Android: scan with the Expo Go app.

> **No Xcode or Android Studio needed** to get started. Expo Go handles it.

---

## Environment variables

### Root `.env` (used by Docker Compose and server)

| Variable | Description |
|---|---|
| `DATABASE_URL` | JDBC PostgreSQL connection string (e.g. `jdbc:postgresql://localhost:5432/orcadive?user=orcadive&password=orcadive`) |
| `JWT_SECRET` | Long random string for signing JWTs — generate with `openssl rand -hex 32` |
| `GITHUB_CLIENT_ID` | From your GitHub OAuth App |
| `GITHUB_CLIENT_SECRET` | From your GitHub OAuth App |
| `ANTHROPIC_API_KEY` | From https://console.anthropic.com |

> When using Docker Compose, `DATABASE_URL` is overridden automatically to point to the `db` container.

### `mobile/.env`

| Variable | Description |
|---|---|
| `API_URL` | Server URL — use your PC's local IP for physical devices (e.g. `http://10.0.0.12:3000`) |
| `GITHUB_CLIENT_ID` | Same Client ID as server — public, no secret on device |

---

## Team roles

| Area | Files to own |
|---|---|
| Mobile — Dashboard + UI | `mobile/app/(tabs)/dashboard.tsx`, `components/TeamMemberCard.tsx`, `components/StatusBadge.tsx`, `store/teamStore.ts` |
| Mobile — Status + AI | `mobile/app/(tabs)/status.tsx`, `hooks/useStatusSuggestion.ts` |
| Mobile — Auth + Settings | `mobile/app/(auth)/login.tsx`, `hooks/useGitHubAuth.ts`, `mobile/app/(tabs)/settings.tsx`, `store/authStore.ts` |
| Backend — Auth + DB | `server/.../controller/AuthController.kt`, `server/.../db/Tables.kt`, `server/.../security/JwtUtil.kt` |
| Backend — Status + WebSocket | `server/.../controller/StatusController.kt`, `server/.../websocket/WebSocketConfig.kt` |
| Integrations — GitHub + PRs | `server/.../controller/PrController.kt`, `mobile/app/(tabs)/prs.tsx`, `components/PRItem.tsx`, `store/prStore.ts` |
| AI Suggestions | `server/.../controller/SuggestController.kt`, `server/.../service/ClaudeService.kt` |
| Agent Orchestration | `server/.../controller/AgentController.kt`, `server/.../security/AgentApiKeyFilter.kt`, `mobile/app/(tabs)/agents.tsx`, `mobile/store/agentStore.ts`, `mobile/components/AgentCard.tsx` |

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
| `GET` | `/api/agents` | JWT | List all agents for the team |
| `POST` | `/api/agents` | JWT | Register a new agent (returns API key once) |
| `DELETE` | `/api/agents/:id` | JWT | Remove an agent |
| `GET` | `/api/agents/:id/runs` | JWT | Fetch run history for an agent |
| `POST` | `/api/agents/:id/runs` | JWT | Assign a task to an agent |
| `POST` | `/api/agents/:agentId/runs/:runId/cancel` | JWT | Cancel a pending/running task |
| `POST` | `/api/agents/webhook/status` | API Key | Agent self-reports its status |
| `POST` | `/api/agents/webhook/run` | API Key | Agent reports run progress/completion |

STOMP WebSocket destinations (subscribe via `/topic/team.{teamId}.*`):
- `/topic/team.{teamId}.status` — when a member posts a status update
- `/topic/team.{teamId}.agent.status` — when an agent's status changes
- `/topic/team.{teamId}.agent.run.created` — when a task is assigned to an agent
- `/topic/team.{teamId}.agent.run.updated` — when an agent run changes state

WebSocket endpoint: `/ws` (SockJS fallback enabled)
STOMP auth: pass JWT as `token` header on CONNECT frame

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

Tables defined in `server/src/main/resources/schema.sql` (Exposed ORM mappings in `Tables.kt`):

- **teams** — team groups
- **users** — GitHub-authenticated users, linked to a team
- **statuses** — status updates (one per post, latest queried via `LATERAL`)
- **prs** — cached PR records with author linkage (used for `openPRs` count)
- **team_repos** — repos a team is tracking for PR polling
- **agents** — AI agents registered to a team (name, type, api_key_hash, status, last_seen)
- **agent_runs** — task assignments and their results (task, status, output, timestamps)
- **latest_statuses** — convenience view (latest status per user)

---

## Agent webhook auth

Agents authenticate via API key in the `Authorization` header:

```
Authorization: Bearer agent:<api-key>
```

The API key is returned **once** when you register an agent via `POST /api/agents` (JWT-authenticated). The server stores only a SHA-256 hash — the plaintext key cannot be retrieved again.

Agent types: `custom`, `copilot`, `ci_bot`

Agent statuses: `idle`, `running`, `error`, `offline`

Run statuses: `pending`, `running`, `success`, `failure`, `cancelled`

---

## Phase 2 ideas

- Push notifications when a teammate posts or tags you as a blocker
- Slack integration — post daily radar summary to a channel
- Status history / weekly summary view
- Team invite links (replace manual DB assignment)
- GitHub webhook for real-time PR status updates (vs polling)
- MMKV offline caching layer for mobile
- Agent registration UI in Settings screen
- Agent run log streaming via WebSocket
