import { Router } from "express";
import axios from "axios";
import jwt from "jsonwebtoken";
import { db } from "../db";

export const authRouter = Router();

// Step 1: Mobile sends the code from GitHub OAuth
// Step 2: Server exchanges it for a GitHub access token
// Step 3: Fetch GitHub user, upsert in DB, return JWT
authRouter.post("/github", async (req, res) => {
  const { code } = req.body;
  if (!code) return res.status(400).json({ error: "Missing code" });

  try {
    // Exchange code for GitHub access token
    const tokenRes = await axios.post(
      "https://github.com/login/oauth/access_token",
      {
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
      },
      { headers: { Accept: "application/json" } }
    );

    const githubToken = tokenRes.data.access_token;
    if (!githubToken) {
      return res.status(400).json({ error: "GitHub token exchange failed" });
    }

    // Fetch the GitHub user profile
    const userRes = await axios.get("https://api.github.com/user", {
      headers: { Authorization: `Bearer ${githubToken}` },
    });

    const { id: githubId, login, name, avatar_url } = userRes.data;

    // Upsert user in our DB
    const result = await db.query(
      `INSERT INTO users (github_id, username, display_name, avatar_url, github_token)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (github_id)
       DO UPDATE SET github_token = $5, display_name = $3, avatar_url = $4
       RETURNING id, team_id`,
      [githubId, login, name ?? login, avatar_url, githubToken]
    );

    const { id: userId, team_id: teamId } = result.rows[0];

    // Issue our own JWT
    const token = jwt.sign(
      { userId, teamId, githubLogin: login },
      process.env.JWT_SECRET!,
      { expiresIn: "30d" }
    );

    res.json({ token, userId, username: login });
  } catch (err) {
    console.error("GitHub auth error:", err);
    res.status(500).json({ error: "Authentication failed" });
  }
});
