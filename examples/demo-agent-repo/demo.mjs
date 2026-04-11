/**
 * Polls OrcaDive for pending agent runs, reports progress, posts a standup.
 * Optionally calls Anthropic (Claude) to draft the standup from run context.
 *
 * Env:
 *   API_BASE_URL       — e.g. http://localhost:3000 (no trailing slash)
 *   AGENT_API_KEY      — full key from Register agent (starts with "agent:")
 *   ANTHROPIC_API_KEY  — optional; if set, standup text is generated via Claude
 *   ANTHROPIC_MODEL    — optional; default matches server (ClaudeService)
 *   WORKING_SUMMARY    — optional; one line about your local repo/path (included in the prompt)
 *   REPO_ROOT          — optional; absolute path to a local repo (e.g. coffeefarm). If set, reads prompt.md from that root.
 *                      On startup, unset keys are also filled from ../../.env (repo-root .env next to server/mobile).
 *   PROMPT_FILE        — optional; file under REPO_ROOT (default: prompt.md)
 *   IMPLEMENT_ENABLE   — optional; default true. Set false or 0 to skip Claude tool implementation (mock run completion only).
 *   MAX_TOOL_ROUNDS    — optional; max assistant/tool cycles per run (default 20, max 100).
 *   DEMO_POLL_INTERVAL_MS — optional; if set to a positive number, keep polling in a loop every
 *                          N ms until Ctrl+C. Standup is posted only after a cycle that processed
 *                          at least one run (idle cycles do not spam Radar). One-shot (unset/0)
 *                          still posts a standup every run, including when there were no tasks.
 *
 * Usage:
 *   API_BASE_URL=http://localhost:3000 AGENT_API_KEY='agent:...' ANTHROPIC_API_KEY='...' REPO_ROOT=C:/Users/you/coffeefarm node demo.mjs
 */

import { existsSync, readFileSync } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runImplementationWithTools } from "./utils/anthropicToolRunner.mjs";
import { normalizeRepoRootForNode } from "./utils/pathUtils.mjs";
import { resolveRepoRootAbs } from "./utils/repoSandbox.mjs";
import { truncateWithNotice } from "./utils/truncateText.mjs";

/**
 * Loads `orcadive/.env` into process.env for keys that are still unset/empty,
 * so REPO_ROOT / API keys in the repo root file apply when running from examples/demo-agent-repo.
 */
function loadOrcadiveRootEnvIfUnset() {
  try {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const rootEnv = path.resolve(here, "..", "..", ".env");
    if (!existsSync(rootEnv)) return;
    const raw = readFileSync(rootEnv, "utf8");
    for (const line of raw.split("\n")) {
      let t = line.trim().replace(/^\ufeff/, "");
      if (!t || t.startsWith("#")) continue;
      if (t.startsWith("export ")) t = t.slice(7).trim();
      const eq = t.indexOf("=");
      if (eq <= 0) continue;
      const key = t.slice(0, eq).trim();
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
      if (process.env[key]) continue;
      let val = t.slice(eq + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      process.env[key] = val;
    }
  } catch {
    /* ignore */
  }
}

loadOrcadiveRootEnvIfUnset();

const base = (process.env.API_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const rawKey = process.env.AGENT_API_KEY;
const anthropicKey = process.env.ANTHROPIC_API_KEY;
const anthropicModel =
  process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-20250514";
const workingSummary = (process.env.WORKING_SUMMARY ?? "").trim();
const repoRootRaw = (process.env.REPO_ROOT ?? "").trim();
const promptFileName = (process.env.PROMPT_FILE ?? "prompt.md").trim() || "prompt.md";

const implementEnable = !/^false|0$/i.test(
  String(process.env.IMPLEMENT_ENABLE ?? "").trim(),
);
const rawMaxRounds = parseInt(process.env.MAX_TOOL_ROUNDS ?? "20", 10);
const maxToolRounds =
  Number.isFinite(rawMaxRounds) && rawMaxRounds > 0
    ? Math.min(rawMaxRounds, 100)
    : 20;

const rawWatchMs = parseInt(process.env.DEMO_POLL_INTERVAL_MS ?? "0", 10);
const watchPollMs =
  Number.isFinite(rawWatchMs) && rawWatchMs > 0
    ? Math.min(rawWatchMs, 3_600_000)
    : 0;

/** Cap how much of prompt.md is sent to Claude (approx. cost / context). */
const MAX_PROMPT_MD_CHARS = 24_000;

function getNodeErrCode(e) {
  return e && typeof e === "object" && "code" in e ? e.code : String(e);
}

async function loadPromptFromRepo(root, fileName) {
  const normalized = normalizeRepoRootForNode(root);
  if (!normalized) {
    return { content: null, displayPath: null, error: null };
  }
  const resolvedRoot = path.resolve(normalized);
  const filePath = path.join(resolvedRoot, fileName);
  try {
    const raw = await fs.readFile(filePath, "utf8");
    const content = truncateWithNotice(raw, MAX_PROMPT_MD_CHARS);
    return { content, displayPath: filePath, error: null };
  } catch (e) {
    return { content: null, displayPath: filePath, error: getNodeErrCode(e) };
  }
}

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

function extractAnthropicText(body) {
  const blocks = body?.content;
  if (!Array.isArray(blocks)) return null;
  const texts = blocks
    .filter((b) => b?.type === "text" && typeof b.text === "string")
    .map((b) => b.text.trim());
  return texts.length ? texts.join("\n\n") : null;
}

/**
 * Drafts a short async-standup style update from OrcaDive run context.
 * Does not log or persist the API key.
 */
async function generateStandupWithClaude({ runNotes, hadRuns, promptMd }) {
  const lines = [];
  if (workingSummary) {
    lines.push(`Local / repo context: ${workingSummary}`);
  }
  if (promptMd?.content) {
    lines.push(
      `The following is the project's ${promptFileName} (authoritative instructions for what this agent should do):`,
    );
    lines.push("---");
    lines.push(promptMd.content);
    lines.push("---");
  } else if (repoRootRaw && promptMd?.error) {
    lines.push(
      `Could not read ${promptFileName} at ${promptMd.displayPath} (${promptMd.error}). Mention briefly that the instruction file was missing or unreadable.`,
    );
  }
  if (hadRuns && runNotes.length) {
    lines.push("Tasks processed this run (includes any files written under REPO_ROOT):");
    runNotes.forEach((n, i) => lines.push(`${i + 1}. ${n}`));
  } else {
    lines.push("No pending or running OrcaDive tasks were picked up this run.");
  }

  const context = lines.join("\n");

  const userPrompt =
    `You are an AI teammate posting a brief standup to a team Radar.\n` +
    `Write 2–4 short sentences: what you focused on, what you completed or tried, and any blockers or next steps.\n` +
    `If ${promptFileName} was provided above, align your update with those goals (what you did toward them, what's next).\n` +
    `Sound natural and specific to the context below. Do not mention Anthropic, APIs, or that you are a language model.\n\n` +
    context;

  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": anthropicKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: anthropicModel,
      max_tokens: 400,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });

  const raw = await r.text();
  let data;
  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {
    data = { raw };
  }
  if (!r.ok) {
    throw new Error(`Anthropic ${r.status}: ${raw}`);
  }

  const text = extractAnthropicText(data);
  if (!text) {
    throw new Error("Anthropic response had no text content");
  }
  return text;
}

function fallbackStandup({ runNotes, hadRuns, promptMd }) {
  const ts = new Date().toISOString();
  const parts = [`[demo] ${ts}`];
  if (promptMd?.content) {
    parts.push(`Read ${promptFileName} (${promptMd.content.length} chars).`);
  } else if (repoRootRaw && promptMd?.error) {
    parts.push(`Could not read ${promptFileName}: ${promptMd.error}`);
  }
  if (hadRuns && runNotes.length) {
    parts.push(`Completed: ${runNotes.join(" | ")}`);
  } else {
    parts.push(
      "No OrcaDive runs this sync; assign a task in the Agents tab and re-run.",
    );
  }
  return parts.join(" — ");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * One poll + optional task execution + optional standup.
 * @param {{ watchMode: boolean; logBanner: boolean }} opts
 * @returns {Promise<boolean>} true if at least one run was processed this cycle
 */
async function runCycle(opts) {
  const { watchMode, logBanner } = opts;
  if (logBanner) {
    console.log("OrcaDive demo agent — polling for runs…");
  }

  const promptMd = await loadPromptFromRepo(repoRootRaw, promptFileName);
  const repoAbs = resolveRepoRootAbs(repoRootRaw);
  const useImplement =
    Boolean(repoAbs) && implementEnable && Boolean(anthropicKey);

  if (logBanner && repoRootRaw) {
    if (promptMd.content) {
      console.log(`Loaded ${promptFileName} from ${promptMd.displayPath}`);
    } else {
      console.warn(
        `REPO_ROOT set but could not read ${promptFileName} (${promptMd.displayPath}): ${promptMd.error}`,
      );
    }
  }
  if (logBanner && repoAbs && implementEnable && !anthropicKey) {
    console.warn(
      "REPO_ROOT set but ANTHROPIC_API_KEY missing — skipping Claude tool implementation; using mock run completion.",
    );
  }

  const runNotes = [];
  let hadRuns = false;

  const runsData = await pollRuns();
  const runs = runsData.runs ?? [];
  if (runs.length === 0) {
    if (!watchMode) {
      console.log(
        "No pending/running tasks. Assign one from the mobile Agents tab, then re-run.",
      );
    }
  } else {
    for (const run of runs) {
      if (run.status !== "pending" && run.status !== "running") continue;
      hadRuns = true;
      console.log(`Run ${run.id}: ${run.task}`);

      if (useImplement) {
        await reportRun(run.id, "running", "Implementing with Claude tools under REPO_ROOT…");
        try {
          const impl = await runImplementationWithTools({
            apiKey: anthropicKey,
            model: anthropicModel,
            repoRootAbs: repoAbs,
            taskText: run.task,
            promptMdContent: promptMd.content ?? null,
            maxRounds: maxToolRounds,
          });
          if (impl.ok) {
            const summary =
              impl.summaryText.length > 1_800
                ? `${impl.summaryText.slice(0, 1_800)}…`
                : impl.summaryText;
            const filesPart =
              impl.touchedFiles.length > 0
                ? `Files touched: ${impl.touchedFiles.join(", ")}`
                : "No files written.";
            const output = `${summary} | ${filesPart}`;
            await reportRun(run.id, "success", output);
            runNotes.push(`Task: ${run.task}. Result: ${output}`);
          } else {
            const partial =
              impl.touchedFiles.length > 0
                ? ` | Partial files: ${impl.touchedFiles.join(", ")}`
                : "";
            const failMsg = `${impl.error}${impl.summaryText ? ` | ${impl.summaryText.slice(0, 400)}` : ""}${partial}`;
            await reportRun(run.id, "failure", failMsg);
            runNotes.push(`Task: ${run.task}. FAILED: ${failMsg}`);
          }
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          await reportRun(run.id, "failure", msg);
          runNotes.push(`Task: ${run.task}. FAILED: ${msg}`);
        }
      } else {
        if (anthropicKey) {
          if (!repoAbs) {
            console.warn(
              "[demo] REPO_ROOT is not set or did not resolve — Claude standups still run, but tasks use mock mode (no files written). Add REPO_ROOT to orcadive/.env or export it.",
            );
          } else if (!implementEnable) {
            console.warn(
              "[demo] IMPLEMENT_ENABLE is off — mock task completion only (no write_file).",
            );
          }
        }
        await reportRun(run.id, "running", "Working on mock repo…");
        const outputParts = [
          "Mock work complete (see examples/demo-agent-repo/README.md).",
        ];
        if (promptMd.content) {
          outputParts.push(
            `Loaded ${promptFileName} (${promptMd.content.length} chars from disk).`,
          );
        } else if (repoRootRaw && promptMd?.error) {
          outputParts.push(
            `Could not load ${promptFileName}: ${promptMd.error}`,
          );
        }
        const output = outputParts.join(" ");
        await reportRun(run.id, "success", output);
        runNotes.push(`Task: ${run.task}. Result: ${output}`);
      }
    }
  }

  const postStandupThisCycle = hadRuns || !watchMode;
  if (postStandupThisCycle) {
    let standup;
    if (anthropicKey) {
      console.log("Drafting standup with Claude…");
      standup = await generateStandupWithClaude({ runNotes, hadRuns, promptMd });
    } else {
      if (!watchMode || hadRuns) {
        console.warn(
          "ANTHROPIC_API_KEY not set — posting a template standup. Set the key to use Claude.",
        );
      }
      standup = fallbackStandup({ runNotes, hadRuns, promptMd });
    }

    await postStandup(standup, null);
    console.log("Posted standup to team Radar.");
  }

  return hadRuns;
}

async function main() {
  if (watchPollMs > 0) {
    console.log(
      `Watch mode: DEMO_POLL_INTERVAL_MS=${watchPollMs} — polling until Ctrl+C (idle cycles do not post standups).`,
    );
    let first = true;
    for (;;) {
      await runCycle({
        watchMode: true,
        logBanner: first,
      });
      first = false;
      await sleep(watchPollMs);
    }
  }

  await runCycle({ watchMode: false, logBanner: true });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
