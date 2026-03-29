import { Router } from "express";
import axios from "axios";
import { db } from "../db";
import { AuthRequest } from "../middleware/authenticate";

export const prRouter = Router();

function ageLabel(createdAt: string): string {
  const hours = (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60);
  if (hours < 24) return `${Math.round(hours)}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function mapState(pr: any): string {
  if (pr.draft) return "draft";
  if (pr.requested_reviewers?.length > 0) return "review_requested";
  if (pr.merged_at) return "merged";
  return "open";
}

prRouter.get("/prs", async (req: AuthRequest, res) => {
  try {
    // Get all repos connected to this team
    const repoResult = await db.query(
      `SELECT repo_full_name FROM team_repos WHERE team_id = $1`,
      [req.teamId]
    );

    // Get a team member's GitHub token to make API calls
    const tokenResult = await db.query(
      `SELECT github_token FROM users WHERE team_id = $1 LIMIT 1`,
      [req.teamId]
    );
    const githubToken = tokenResult.rows[0]?.github_token;

    const allPRs: any[] = [];

    for (const row of repoResult.rows) {
      const [owner, repo] = row.repo_full_name.split("/");
      try {
        const { data } = await axios.get(
          `https://api.github.com/repos/${owner}/${repo}/pulls?state=open&per_page=20`,
          {
            headers: {
              Authorization: `Bearer ${githubToken}`,
              Accept: "application/vnd.github.v3+json",
            },
          }
        );
        for (const pr of data) {
          allPRs.push({
            id: String(pr.id),
            title: pr.title,
            repo: row.repo_full_name,
            author: pr.user.login,
            status: mapState(pr),
            url: pr.html_url,
            ageLabel: ageLabel(pr.created_at),
          });
        }
      } catch {
        // Skip repos that fail (permissions, etc.)
      }
    }

    // Sort: review_requested first, then open, then draft
    const order = { review_requested: 0, open: 1, draft: 2 };
    allPRs.sort(
      (a, b) =>
        (order[a.status as keyof typeof order] ?? 3) -
        (order[b.status as keyof typeof order] ?? 3)
    );

    res.json({ prs: allPRs });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch PRs" });
  }
});

// POST /api/team/repos — add a repo to track
prRouter.post("/repos", async (req: AuthRequest, res) => {
  const { repoFullName } = req.body;
  if (!repoFullName) return res.status(400).json({ error: "repoFullName required" });
  await db.query(
    `INSERT INTO team_repos (team_id, repo_full_name)
     VALUES ($1, $2) ON CONFLICT DO NOTHING`,
    [req.teamId, repoFullName]
  );
  res.json({ ok: true });
});
