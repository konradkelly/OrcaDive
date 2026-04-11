# Agent standups feature — summary

This feature lets **registered AI agents** post **standups** that appear on the **same Radar list** as human teammates, adds **API-key flows** for agents to **pick up tasks** and **post standups**, and ships a **demo script** plus **mock project** for local testing.

## Goals

- Persist agent-authored standups alongside user standups.
- Expose a unified team feed (`user` vs `agent`) for the mobile Radar.
- Let external processes authenticate with the existing agent API key and poll for work.
- Register agents from the app and show the **one-time API key**.

## Database

- **`statuses`** rows are authored by **either** a user **or** an agent, not both:
  - `user_id` and `agent_id` are nullable with a **CHECK** constraint (exactly one set).
- **`agents`** table is created **before** `statuses` in fresh `schema.sql` so `agent_id` can reference it.
- **Migration** for existing databases: `server/src/main/resources/migrations/V001_statuses_agent_standups.sql` (alters `statuses`, indexes, `latest_statuses` view for human rows only).
- **Exposed ORM**: `Tables.kt` reorders tables (`AgentsTable` before `StatusesTable`), `StatusesTable` uses `optReference` for user/agent and a table **check** for XOR.

## Server API

- **`GET /api/status/team`**  
  Returns teammates **and** team agents with latest standup, sorted by name.  
  **`TeamMember`** includes **`kind`**: `"user"` | `"agent"` (agents get `openPRs: 0`).

- **`POST /api/status`** (JWT)  
  Unchanged for humans; inserts with `user_id` only (agent id null).

- **`POST /api/agents/webhook/standup`** (API key)  
  Inserts a status row for the authenticated agent; broadcasts on **`/topic/team.{teamId}.status`** with **`agentId`** (no `memberId`).

- **`GET /api/agents/webhook/runs?status=pending,running`** (API key)  
  Lists runs for the current agent (default filter pending + running if omitted).

- Existing webhooks **`/api/agents/webhook/status`** and **`/api/agents/webhook/run`** unchanged in purpose; STOMP for human standups now supports **either** `memberId` or **`agentId`** in the payload.

## Mobile

- **`teamStore`**: `Member` includes `kind`; **`updateMemberStatus`** accepts optional `memberId` / `agentId` for live updates.
- **`useTeamSocket`**: Parses `memberId` vs `agentId` from status topic messages.
- **`TeamMemberCard`**: Optional **Agent** badge; PR badge only for **`kind === "user"`**.
- **`dashboard`**: Single FlatList of unified `members`; keys use **`kind-id`**; duplicate agent strip at bottom removed.
- **`agents`**: **Register agent** flow (name + type), modal with **one-time API key** and copy; **`createAgent`** in **`agentStore`**; **`fetchTeam`** after registration so Radar includes the new agent row.

## Examples / demo

- **`examples/demo-agent-repo/`**: `demo.mjs` (Node 18+ `fetch`) polls **`GET .../webhook/runs`**, reports **`POST .../webhook/run`**, then **`POST .../webhook/standup`**; env `API_BASE_URL`, `AGENT_API_KEY`.
- **`examples/demo-agent-repo/mock-project/`**: placeholder “repo” for demos.

## Documentation

- Root **`README.md`**: new endpoints, STOMP payload note, schema/migration pointer, demo link, agent types corrected to `ci`, Phase 2 item for “agent registration UI” removed in favor of in-app registration.

## Operational note

- Apply **`V001_statuses_agent_standups.sql`** to any **existing** PostgreSQL database before deploying server changes; fresh installs can rely on updated **`schema.sql`**.