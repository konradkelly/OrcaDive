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
| `ANTHROPIC_API_KEY` | Optional — same key as the OrcaDive server `.env`; if set, the standup is drafted by **Claude** from your run context |
| `ANTHROPIC_MODEL` | Optional — defaults to `claude-sonnet-4-20250514` (same as the server) |
| `WORKING_SUMMARY` | Optional — e.g. `C:\dev\my-app — feature/foo branch` — included in the Claude prompt so the Radar update mentions what you are working on locally |
| `REPO_ROOT` | Optional — **absolute path** to a local clone (e.g. **coffeefarm**). When set, the script reads **`prompt.md`** from that directory and passes its contents into the Claude standup prompt (and into run output). |
| `PROMPT_FILE` | Optional — filename under `REPO_ROOT` (default: `prompt.md`) |

On **Windows**, prefer `REPO_ROOT=C:/Users/you/coffeefarm` or `C:\Users\you\coffeefarm`. If you use **Git Bash** paths like `/c/Users/you/coffeefarm`, the script normalizes them to a Windows path before reading the file.

## Run

From this directory:

```bash
set API_BASE_URL=http://localhost:3000
set AGENT_API_KEY=agent:YOUR_KEY_HERE
set ANTHROPIC_API_KEY=your_anthropic_key
set WORKING_SUMMARY=C:\path\to\your\repo — short note
set REPO_ROOT=C:\Users\you\coffeefarm
node demo.mjs
```

On macOS/Linux use `export` instead of `set`.

The script will:

1. `GET /api/agents/webhook/runs?status=pending,running` — pick up tasks you assigned from the **Agents** tab.
2. `POST /api/agents/webhook/run` — mark runs running, then success (mock output).
3. `POST /api/agents/webhook/standup` — post a standup so it appears on the **Radar** next to teammates (text from **Claude** if `ANTHROPIC_API_KEY` is set, otherwise a short template). With **`REPO_ROOT`**, the standup is grounded in your repo’s **`prompt.md`** (truncated if very large).

If no tasks exist, assign one in the app first, then run the script again.

## Mock repo

The `mock-project/` subfolder is a tiny placeholder “repository” for demos. Point your real agent tooling at this path if you want filesystem activity without a Git remote.

Shared helpers live under **`utils/`**: `utils/pathUtils.mjs` (`normalizeRepoRootForNode`) for Git Bash → Windows repo roots, and `utils/truncateText.mjs` (`truncateWithNotice`) for capping prompt file size sent to Claude.
