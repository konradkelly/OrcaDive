import fs from "node:fs/promises";
import path from "node:path";
import {
  assertPathInRepo,
  toRepoRelativePath,
} from "./repoSandbox.mjs";
import { truncateWithNotice } from "./truncateText.mjs";

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";

/** Max bytes read per read_file (UTF-8); remainder noted in response. */
const MAX_READ_BYTES = 400_000;

/** Max characters of read content embedded in tool_result (after truncation notice). */
const MAX_READ_CHARS = 120_000;

const IMPLEMENTATION_TOOLS = [
  {
    name: "list_dir",
    description:
      "List non-hidden files and directories at a path relative to the repo root. Use \".\" for repo root.",
    input_schema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Relative path; use \".\" for repository root.",
        },
        max_depth: {
          type: "integer",
          description: "1 = immediate children only; 2 = one level of nesting under subdirs (capped).",
          enum: [1, 2],
        },
      },
      required: [],
    },
  },
  {
    name: "read_file",
    description:
      "Read a text file relative to the repo root. Large files are truncated in the response.",
    input_schema: {
      type: "object",
      properties: {
        path: { type: "string", description: "File path relative to repo root." },
      },
      required: ["path"],
    },
  },
  {
    name: "write_file",
    description:
      "Create or overwrite a file relative to the repo root. Creates parent directories as needed.",
    input_schema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "File path relative to repo root.",
        },
        content: {
          type: "string",
          description: "Full new file contents (UTF-8).",
        },
      },
      required: ["path", "content"],
    },
  },
];

function extractTextBlocks(content) {
  if (!Array.isArray(content)) return "";
  return content
    .filter((b) => b?.type === "text" && typeof b.text === "string")
    .map((b) => b.text)
    .join("\n\n")
    .trim();
}

async function listDirTool(repoRootAbs, input) {
  const rel =
    typeof input.path === "string" && input.path.trim()
      ? input.path.trim()
      : ".";
  const maxDepth = input.max_depth === 2 ? 2 : 1;
  const dirAbs = assertPathInRepo(repoRootAbs, rel);
  const st = await fs.stat(dirAbs).catch(() => null);
  if (!st) return "Error: path not found";
  if (!st.isDirectory()) return "Error: not a directory";

  const rootNorm = path.resolve(repoRootAbs);
  const lines = [];

  async function walk(dAbs, depthFromTarget) {
    const entries = await fs.readdir(dAbs, { withFileTypes: true });
    const visible = entries
      .filter((e) => !e.name.startsWith("."))
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, 100);

    for (const e of visible) {
      const joined = path.join(dAbs, e.name);
      const display = path.relative(rootNorm, joined).split(path.sep).join("/");
      if (e.isDirectory()) {
        lines.push(`${display}/`);
        if (maxDepth >= 2 && depthFromTarget === 1) {
          try {
            assertPathInRepo(repoRootAbs, path.relative(rootNorm, joined));
            await walk(joined, 2);
          } catch (err) {
            lines.push(
              `# ${display}/ (${err instanceof Error ? err.message : String(err)})`,
            );
          }
        }
      } else {
        lines.push(display);
      }
    }
  }

  await walk(dirAbs, 1);
  return lines.length ? lines.join("\n") : "(empty)";
}

async function readFileTool(repoRootAbs, input) {
  const p = input.path;
  if (typeof p !== "string" || !p.trim()) {
    return "Error: path required";
  }
  const fileAbs = assertPathInRepo(repoRootAbs, p.trim());
  const st = await fs.stat(fileAbs).catch(() => null);
  if (!st) return "Error: file not found";
  if (!st.isFile()) return "Error: not a regular file";
  if (st.size > MAX_READ_BYTES) {
    const buf = Buffer.allocUnsafe(MAX_READ_BYTES);
    const fh = await fs.open(fileAbs, "r");
    try {
      await fh.read(buf, 0, MAX_READ_BYTES, 0);
    } finally {
      await fh.close();
    }
    const slice = buf.toString("utf8");
    return (
      truncateWithNotice(slice, MAX_READ_CHARS) +
      `\n\n[Note: file on disk is ${st.size} bytes; only first ${MAX_READ_BYTES} bytes read]`
    );
  }
  const text = await fs.readFile(fileAbs, "utf8");
  return truncateWithNotice(text, MAX_READ_CHARS);
}

async function writeFileTool(repoRootAbs, input, touchedFiles) {
  const p = input.path;
  const content = input.content;
  if (typeof p !== "string" || !p.trim()) {
    return "Error: path required";
  }
  if (typeof content !== "string") {
    return "Error: content must be a string";
  }
  const fileAbs = assertPathInRepo(repoRootAbs, p.trim());
  await fs.mkdir(path.dirname(fileAbs), { recursive: true });
  await fs.writeFile(fileAbs, content, "utf8");
  const rel = toRepoRelativePath(repoRootAbs, fileAbs);
  if (!touchedFiles.includes(rel)) touchedFiles.push(rel);
  return `Wrote ${rel} (${content.length} characters).`;
}

async function executeTool(name, toolInput, ctx) {
  const { repoRootAbs, touchedFiles } = ctx;
  switch (name) {
    case "list_dir":
      return listDirTool(repoRootAbs, toolInput ?? {});
    case "read_file":
      return readFileTool(repoRootAbs, toolInput ?? {});
    case "write_file":
      return writeFileTool(repoRootAbs, toolInput ?? {}, touchedFiles);
    default:
      return `Error: unknown tool ${name}`;
  }
}

/**
 * Runs Claude with list_dir / read_file / write_file until end_turn or max rounds.
 * @param {object} opts
 * @param {string} opts.apiKey
 * @param {string} opts.model
 * @param {string} opts.repoRootAbs
 * @param {string} opts.taskText
 * @param {string | null} opts.promptMdContent
 * @param {number} opts.maxRounds
 */
export async function runImplementationWithTools({
  apiKey,
  model,
  repoRootAbs,
  taskText,
  promptMdContent,
  maxRounds,
}) {
  const touchedFiles = [];

  const system = [
    "You are an autonomous implementation agent working inside a single local git repository.",
    "You may only inspect and modify files using the provided tools. Paths are always relative to the repository root.",
    "Do not attempt to access .git, node_modules, .env, or other ignored/sensitive areas — the tools will reject those.",
    "Implement the user's task completely when possible: create or edit source files as needed.",
    "Prefer small, focused changes. After finishing, briefly summarize what you did in plain text (you may include a short final message in addition to tool calls).",
  ].join("\n");

  let userBody = `## Task (from OrcaDive run)\n${taskText}\n`;
  if (promptMdContent) {
    userBody += `\n## Project instructions (${"prompt.md"} excerpt)\n${promptMdContent}\n`;
  }
  userBody +=
    "\nUse the tools to explore the repo and implement the task. Start when ready.";

  /** @type {Array<{ role: string, content: unknown }>} */
  const messages = [{ role: "user", content: userBody }];

  let lastText = "";
  let lastStopReason = "";

  for (let round = 0; round < maxRounds; round++) {
    const body = {
      model,
      max_tokens: 8192,
      system,
      tools: IMPLEMENTATION_TOOLS,
      messages,
    };

    const r = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": ANTHROPIC_VERSION,
      },
      body: JSON.stringify(body),
    });

    const raw = await r.text();
    let data;
    try {
      data = raw ? JSON.parse(raw) : {};
    } catch {
      throw new Error(`Anthropic invalid JSON: ${raw.slice(0, 200)}`);
    }
    if (!r.ok) {
      throw new Error(`Anthropic ${r.status}: ${raw}`);
    }

    lastStopReason = data.stop_reason ?? "";
    const content = data.content;
    if (!Array.isArray(content) || content.length === 0) {
      throw new Error("Anthropic returned empty content");
    }

    messages.push({ role: "assistant", content });
    lastText = extractTextBlocks(content) || lastText;

    const toolUses = content.filter((b) => b?.type === "tool_use");
    if (toolUses.length === 0) {
      if (lastStopReason === "end_turn" || lastStopReason === "max_tokens") {
        return {
          ok: true,
          summaryText: lastText || "(no textual summary)",
          touchedFiles: [...touchedFiles],
          stopReason: lastStopReason,
        };
      }
      return {
        ok: true,
        summaryText: lastText || "(stopped)",
        touchedFiles: [...touchedFiles],
        stopReason: lastStopReason,
      };
    }

    /** @type {Array<{ type: string, tool_use_id: string, content: string, is_error?: boolean }>} */
    const toolResults = [];
    for (const tu of toolUses) {
      const id = tu.id;
      const name = tu.name;
      const toolInput = tu.input;
      if (!id || !name) {
        toolResults.push({
          type: "tool_result",
          tool_use_id: id || "unknown",
          content: "Error: invalid tool_use block",
          is_error: true,
        });
        continue;
      }
      try {
        const out = await executeTool(name, toolInput, {
          repoRootAbs,
          touchedFiles,
        });
        toolResults.push({
          type: "tool_result",
          tool_use_id: id,
          content: out,
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        toolResults.push({
          type: "tool_result",
          tool_use_id: id,
          content: `Error: ${msg}`,
          is_error: true,
        });
      }
    }

    messages.push({ role: "user", content: toolResults });
  }

  return {
    ok: false,
    error: `Exceeded max tool rounds (${maxRounds})`,
    summaryText: lastText,
    touchedFiles: [...touchedFiles],
    stopReason: lastStopReason,
  };
}
