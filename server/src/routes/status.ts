import { Router } from "express";
import { io } from "../index";
import { db } from "../db";
import { AuthRequest } from "../middleware/authenticate";

export const statusRouter = Router();

// GET /api/status/team — fetch all current statuses for the team
statusRouter.get("/team", async (req: AuthRequest, res) => {
  try {
    const result = await db.query(
      `SELECT
         u.id, u.display_name AS name, u.avatar_url AS avatar,
         s.text AS status, s.blockers,
         s.created_at AS "updatedAt",
         s.created_at::date = CURRENT_DATE AS "updatedToday",
         (SELECT COUNT(*) FROM prs p WHERE p.author_id = u.id AND p.status != 'merged') AS "openPRs"
       FROM users u
       LEFT JOIN LATERAL (
         SELECT * FROM statuses
         WHERE user_id = u.id
         ORDER BY created_at DESC LIMIT 1
       ) s ON true
       WHERE u.team_id = $1
       ORDER BY u.display_name`,
      [req.teamId]
    );
    res.json({ members: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch team status" });
  }
});

// POST /api/status — post my update, broadcast to team via Socket.io
statusRouter.post("/", async (req: AuthRequest, res) => {
  const { text, blockers } = req.body;
  if (!text?.trim()) return res.status(400).json({ error: "Status text required" });

  try {
    await db.query(
      `INSERT INTO statuses (user_id, team_id, text, blockers)
       VALUES ($1, $2, $3, $4)`,
      [req.userId, req.teamId, text.trim(), blockers?.trim() ?? null]
    );

    // Broadcast to everyone in the team room
    io.to(`team:${req.teamId}`).emit("status:updated", {
      memberId: req.userId,
      status: text.trim(),
      blockers: blockers?.trim() ?? null,
    });

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to post status" });
  }
});
