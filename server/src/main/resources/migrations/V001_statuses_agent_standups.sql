-- Run against existing DBs: psql $DATABASE_URL -f V001_statuses_agent_standups.sql
-- Enables agent-authored standups (exactly one of user_id or agent_id per row).

ALTER TABLE statuses ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE statuses ADD COLUMN IF NOT EXISTS agent_id UUID REFERENCES agents(id);

ALTER TABLE statuses DROP CONSTRAINT IF EXISTS statuses_user_xor_agent;

ALTER TABLE statuses ADD CONSTRAINT statuses_user_xor_agent CHECK (
  (user_id IS NOT NULL AND agent_id IS NULL) OR (user_id IS NULL AND agent_id IS NOT NULL)
);

DROP INDEX IF EXISTS idx_statuses_user_created;

CREATE INDEX IF NOT EXISTS idx_statuses_user_created
  ON statuses(user_id, created_at DESC)
  WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_statuses_agent_created
  ON statuses(agent_id, created_at DESC)
  WHERE agent_id IS NOT NULL;

DROP VIEW IF EXISTS latest_statuses;

CREATE OR REPLACE VIEW latest_statuses AS
  SELECT DISTINCT ON (user_id)
    user_id, team_id, text, blockers, created_at
  FROM statuses
  WHERE user_id IS NOT NULL
  ORDER BY user_id, created_at DESC;
