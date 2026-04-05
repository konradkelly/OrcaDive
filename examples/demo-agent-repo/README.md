# OrcaDive demo agent + mock repo

This folder is a **minimal example** for running an external agent against your OrcaDive server.

## Prerequisites

1. Server running with DB migrated (`server/src/main/resources/migrations/V001_statuses_agent_standups.sql` applied if you have an existing database).
2. Mobile app: **Agents → Register agent**, copy the **API key** (shown once).

## Configure

```bash
cd examples/demo-agent-repo
npm install   # optional; demo uses only Node built-in fetch (Node 18+)
```

Set environment variables:

| Variable | Example |
|----------|---------|
| `API_BASE_URL` | `http://localhost:3000` (or your LAN IP from a phone) |
| `AGENT_API_KEY` | Paste the full key starting with `agent:` |

## Run

From this directory:

```bash
set API_BASE_URL=http://localhost:3000
set AGENT_API_KEY=agent:YOUR_KEY_HERE
node demo.mjs
```

On macOS/Linux use `export` instead of `set`.

The script will:

1. `GET /api/agents/webhook/runs?status=pending,running` — pick up tasks you assigned from the **Agents** tab.
2. `POST /api/agents/webhook/run` — mark runs running, then success (mock output).
3. `POST /api/agents/webhook/standup` — post a standup so it appears on the **Radar** next to teammates.

If no tasks exist, assign one in the app first, then run the script again.

## Mock repo

The `mock-project/` subfolder is a tiny placeholder “repository” for demos. Point your real agent tooling at this path if you want filesystem activity without a Git remote.
