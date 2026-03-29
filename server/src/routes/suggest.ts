import { Router } from "express";
import axios from "axios";
import Anthropic from "@anthropic-ai/sdk";
import { db } from "../db";
import { AuthRequest } from "../middleware/authenticate";

export const suggestRouter = Router();
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

suggestRouter.post("/suggest", async (req: AuthRequest, res) => {
  try {
    // Fetch the user's GitHub token from DB
    const userResult = await db.query(
      `SELECT github_token, username FROM users WHERE id = $1`,
      [req.userId]
    );
    const { github_token, username } = userResult.rows[0];

    // Fetch last 24hrs of GitHub activity
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const eventsRes = await axios.get(
      `https://api.github.com/users/${username}/events`,
      {
        headers: {
          Authorization: `Bearer ${github_token}`,
          Accept: "application/vnd.github.v3+json",
        },
      }
    );

    // Filter to recent events and extract meaningful context
    const recentEvents = eventsRes.data
      .filter((e: any) => e.created_at >= since)
      .slice(0, 15)
      .map((e: any) => {
        switch (e.type) {
          case "PushEvent":
            return `Pushed ${e.payload.commits?.length ?? 1} commit(s) to ${e.repo.name}: "${e.payload.commits?.[0]?.message ?? ""}"`;
          case "PullRequestEvent":
            return `${e.payload.action} PR "${e.payload.pull_request?.title}" in ${e.repo.name}`;
          case "PullRequestReviewEvent":
            return `Reviewed PR "${e.payload.pull_request?.title}" in ${e.repo.name}`;
          case "IssuesEvent":
            return `${e.payload.action} issue "${e.payload.issue?.title}" in ${e.repo.name}`;
          case "CreateEvent":
            return `Created ${e.payload.ref_type} "${e.payload.ref}" in ${e.repo.name}`;
          default:
            return null;
        }
      })
      .filter(Boolean);

    if (recentEvents.length === 0) {
      return res.json({ suggestion: null });
    }

    // Ask Claude to summarise into a casual one-liner
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 80,
      messages: [
        {
          role: "user",
          content: `A developer had this GitHub activity in the last 24 hours:
${recentEvents.join("\n")}

Write a single casual sentence (max 20 words) summarising what they worked on today, written in first person as if they typed it themselves. No preamble, no quotes, just the sentence.`,
        },
      ],
    });

    const suggestion =
      message.content[0].type === "text" ? message.content[0].text.trim() : null;

    res.json({ suggestion });
  } catch (err) {
    console.error("Suggest error:", err);
    // Non-fatal — client handles null gracefully
    res.json({ suggestion: null });
  }
});
