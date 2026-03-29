import { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import { db } from "../db";

export interface AgentRequest extends Request {
  agentId?: string;
  teamId?: string;
}

/**
 * Authenticate requests from AI agents using API key.
 * Agents send: Authorization: Bearer agent:<api-key>
 */
export function authenticateAgent(req: AgentRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer agent:")) {
    return res.status(401).json({ error: "Missing or invalid agent API key" });
  }

  const apiKey = header.slice("Bearer agent:".length);
  const keyHash = crypto.createHash("sha256").update(apiKey).digest("hex");

  db.query(
    `SELECT id, team_id FROM agents WHERE api_key_hash = $1`,
    [keyHash]
  )
    .then((result) => {
      if (result.rows.length === 0) {
        return res.status(401).json({ error: "Invalid agent API key" });
      }
      req.agentId = result.rows[0].id;
      req.teamId = result.rows[0].team_id;

      // Update last_seen
      db.query(`UPDATE agents SET last_seen = NOW() WHERE id = $1`, [req.agentId]);

      next();
    })
    .catch(() => {
      res.status(500).json({ error: "Authentication failed" });
    });
}
