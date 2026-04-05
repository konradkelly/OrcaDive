/**
 * Polls OrcaDive for pending agent runs, reports progress, and can post a standup.
 *
 * Env:
 *   API_BASE_URL  — e.g. http://localhost:3000 (no trailing slash)
 *   AGENT_API_KEY — full key from Register agent (starts with "agent:")
 *
 * Usage: API_BASE_URL=http://localhost:3000 AGENT_API_KEY='agent:...' node demo.mjs
 */

const base = (process.env.API_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const rawKey = process.env.AGENT_API_KEY;
if (!rawKey) {
  console.error("Missing AGENT_API_KEY (copy from app after Register agent)");
  process.exit(1);
}

const authHeader = rawKey.startsWith("Bearer ") ? rawKey : `Bearer ${rawKey}`;

async function getJson(path, opts = {}) {
  const r = await fetch(`${base}${path}`, {
    ...opts,
    headers: {
      Authorization: authHeader,
      "Content-Type": "application/json",
      ...opts.headers,
    },
  });
  const text = await r.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  if (!r.ok) {
    throw new Error(`${r.status} ${path}: ${text}`);
  }
  return data;
}

async function postStandup(text, blockers = null) {
  return getJson("/api/agents/webhook/standup", {
    method: "POST",
    body: JSON.stringify({ text, blockers }),
  });
}

async function reportRun(runId, status, output = null) {
  return getJson("/api/agents/webhook/run", {
    method: "POST",
    body: JSON.stringify({ runId, status, output }),
  });
}

async function pollRuns() {
  const q = new URLSearchParams({ status: "pending,running" });
  return getJson(`/api/agents/webhook/runs?${q}`);
}

async function main() {
  console.log("OrcaDive demo agent — polling for runs…");

  const runsData = await pollRuns();
  const runs = runsData.runs ?? [];
  if (runs.length === 0) {
    console.log("No pending/running tasks. Assign one from the mobile Agents tab, then re-run.");
  } else {
    for (const run of runs) {
      if (run.status !== "pending" && run.status !== "running") continue;
      console.log(`Run ${run.id}: ${run.task}`);
      await reportRun(run.id, "running", "Working on mock repo…");
      await reportRun(
        run.id,
        "success",
        "Mock work complete (see examples/demo-agent-repo/README.md).",
      );
    }
  }

  const standup = `[demo] Standup ${new Date().toISOString()} — synced mock repo, reviewed open tasks.`;
  await postStandup(standup, null);
  console.log("Posted standup to team Radar.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
