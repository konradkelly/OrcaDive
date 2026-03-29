-- Run this once against your PostgreSQL database
-- psql $DATABASE_URL -f schema.sql

CREATE TABLE IF NOT EXISTS teams (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  github_id     BIGINT UNIQUE NOT NULL,
  username      TEXT NOT NULL,
  display_name  TEXT NOT NULL,
  avatar_url    TEXT,
  github_token  TEXT,
  team_id       UUID REFERENCES teams(id),
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS statuses (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id),
  team_id     UUID NOT NULL REFERENCES teams(id),
  text        TEXT NOT NULL,
  blockers    TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast "latest status per user" queries
CREATE INDEX IF NOT EXISTS idx_statuses_user_created
  ON statuses(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS prs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  github_pr_id  BIGINT UNIQUE NOT NULL,
  repo          TEXT NOT NULL,
  title         TEXT NOT NULL,
  author_id     UUID REFERENCES users(id),
  status        TEXT NOT NULL DEFAULT 'open',  -- open, draft, review_requested, merged
  url           TEXT NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_prs_author_status
  ON prs(author_id, status);

CREATE TABLE IF NOT EXISTS team_repos (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id         UUID NOT NULL REFERENCES teams(id),
  repo_full_name  TEXT NOT NULL,     -- e.g. "konrad/cascadia-gear"
  added_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(team_id, repo_full_name)
);

-- AI agents registered to a team
CREATE TABLE IF NOT EXISTS agents (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id     UUID NOT NULL REFERENCES teams(id),
  name        TEXT NOT NULL,                    -- e.g. "Copilot Coding Agent"
  type        TEXT NOT NULL DEFAULT 'custom',   -- custom, copilot, ci
  avatar_url  TEXT,
  api_key_hash TEXT NOT NULL,                   -- SHA-256 of the agent's API key
  status      TEXT NOT NULL DEFAULT 'idle',     -- idle, running, error, offline
  last_seen   TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agents_team
  ON agents(team_id);

-- Agent run history (tasks assigned or self-reported)
CREATE TABLE IF NOT EXISTS agent_runs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id    UUID NOT NULL REFERENCES agents(id),
  team_id     UUID NOT NULL REFERENCES teams(id),
  task        TEXT NOT NULL,                     -- "Run linter on PR #47"
  status      TEXT NOT NULL DEFAULT 'pending',   -- pending, running, success, failure, cancelled
  output      TEXT,                              -- summary or log output
  started_at  TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_runs_agent
  ON agent_runs(agent_id, created_at DESC);

-- Convenience view: latest status per user
CREATE OR REPLACE VIEW latest_statuses AS
  SELECT DISTINCT ON (user_id)
    user_id, team_id, text, blockers, created_at
  FROM statuses
  ORDER BY user_id, created_at DESC;
