import { Router } from "express";
import crypto from "crypto";
import { db } from "../db";
import { io } from "../index";
import { AuthRequest } from "../middleware/authenticate";
import { AgentRequest, authenticateAgent } from "../middleware/authenticateAgent";

export const agentUserRouter = Router();
export const agentWebhookRouter = Router();

// ── User-facing routes (JWT auth, managed via the app) ──────────────

// GET /api/agents — list all agents for my team
agentUserRouter.get("/", async (req: AuthRequest, res) => {
  try {
    const result = await db.query(
      `SELECT id, name, type, avatar_url, status, last_seen, created_at
       FROM agents WHERE team_id = $1
       ORDER BY name`,
      [req.teamId]
    );
    res.json({ agents: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch agents" });
  }
});

// POST /api/agents — register a new agent, returns the API key (shown once)
agentUserRouter.post("/", async (req: AuthRequest, res) => {
  const { name, type, avatarUrl } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: "Agent name required" });

  const validTypes = ["custom", "copilot", "ci"];
  const agentType = validTypes.includes(type) ? type : "custom";

  // Generate a random API key — only returned once
  const apiKey = crypto.randomBytes(32).toString("hex");
  const keyHash = crypto.createHash("sha256").update(apiKey).digest("hex");

  try {
    const result = await db.query(
      `INSERT INTO agents (team_id, name, type, avatar_url, api_key_hash)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, name, type`,
      [req.teamId, name.trim(), agentType, avatarUrl ?? null, keyHash]
    );

    res.json({
      agent: result.rows[0],
      apiKey: `agent:${apiKey}`,  // Show once — user must save this
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create agent" });
  }
});

// DELETE /api/agents/:id — remove an agent
agentUserRouter.delete("/:id", async (req: AuthRequest, res) => {
  try {
    await db.query(
      `DELETE FROM agents WHERE id = $1 AND team_id = $2`,
      [req.params.id, req.teamId]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete agent" });
  }
});

// GET /api/agents/:id/runs — get run history for an agent
agentUserRouter.get("/:id/runs", async (req: AuthRequest, res) => {
  try {
    const result = await db.query(
      `SELECT id, task, status, output, started_at, completed_at, created_at
       FROM agent_runs
       WHERE agent_id = $1 AND team_id = $2
       ORDER BY created_at DESC
       LIMIT 50`,
      [req.params.id, req.teamId]
    );
    res.json({ runs: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch runs" });
  }
});

// POST /api/agents/:id/runs — assign a task to an agent (from the app)
agentUserRouter.post("/:id/runs", async (req: AuthRequest, res) => {
  const { task } = req.body;
  if (!task?.trim()) return res.status(400).json({ error: "Task description required" });

  try {
    const result = await db.query(
      `INSERT INTO agent_runs (agent_id, team_id, task, status)
       VALUES ($1, $2, $3, 'pending')
       RETURNING id, task, status, created_at`,
      [req.params.id, req.teamId, task.trim()]
    );

    // Notify the team
    io.to(`team:${req.teamId}`).emit("agent:run_created", {
      agentId: req.params.id,
      run: result.rows[0],
    });

    res.json({ run: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create run" });
  }
});

// POST /api/agents/:agentId/runs/:runId/cancel — cancel a run
agentUserRouter.post("/:agentId/runs/:runId/cancel", async (req: AuthRequest, res) => {
  try {
    const result = await db.query(
      `UPDATE agent_runs
       SET status = 'cancelled', completed_at = NOW()
       WHERE id = $1 AND agent_id = $2 AND team_id = $3 AND status IN ('pending', 'running')
       RETURNING id, status`,
      [req.params.runId, req.params.agentId, req.teamId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Run not found or already completed" });
    }

    io.to(`team:${req.teamId}`).emit("agent:run_updated", {
      agentId: req.params.agentId,
      run: result.rows[0],
    });

    res.json({ run: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to cancel run" });
  }
});

// ── Agent-facing routes (API key auth, called by agents themselves) ─

// POST /api/agents/webhook/status — agent reports its own status
agentWebhookRouter.post("/status", authenticateAgent, async (req: AgentRequest, res) => {
  const { status, statusText } = req.body;
  const validStatuses = ["idle", "running", "error", "offline"];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: `Status must be one of: ${validStatuses.join(", ")}` });
  }

  try {
    await db.query(
      `UPDATE agents SET status = $1, last_seen = NOW() WHERE id = $2`,
      [status, req.agentId]
    );

    io.to(`team:${req.teamId}`).emit("agent:status_updated", {
      agentId: req.agentId,
      status,
      statusText: statusText ?? null,
    });

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update status" });
  }
});

// POST /api/agents/webhook/run — agent reports a run update
agentWebhookRouter.post("/run", authenticateAgent, async (req: AgentRequest, res) => {
  const { runId, status, output } = req.body;
  const validStatuses = ["running", "success", "failure"];
  if (!runId) return res.status(400).json({ error: "runId required" });
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: `Status must be one of: ${validStatuses.join(", ")}` });
  }

  try {
    const updates: string[] = [`status = $1`];
    const params: any[] = [status];
    let idx = 2;

    if (output) {
      updates.push(`output = $${idx}`);
      params.push(output);
      idx++;
    }
    if (status === "running") {
      updates.push(`started_at = COALESCE(started_at, NOW())`);
    }
    if (status === "success" || status === "failure") {
      updates.push(`completed_at = NOW()`);
    }

    params.push(runId, req.agentId);
    const result = await db.query(
      `UPDATE agent_runs SET ${updates.join(", ")}
       WHERE id = $${idx} AND agent_id = $${idx + 1}
       RETURNING id, task, status, output, started_at, completed_at`,
      params
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Run not found" });
    }

    io.to(`team:${req.teamId}`).emit("agent:run_updated", {
      agentId: req.agentId,
      run: result.rows[0],
    });

    res.json({ run: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update run" });
  }
});
