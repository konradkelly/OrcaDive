import path from "node:path";
import { normalizeRepoRootForNode } from "./pathUtils.mjs";

/** Path segments that must not appear anywhere in a repo-relative path. */
const DENY_SEGMENTS = new Set([
  ".git",
  "node_modules",
  ".svn",
  ".hg",
]);

/** Basenames that must not be read or written. */
const DENY_BASENAMES = new Set([
  ".env",
  ".env.local",
  ".env.production",
  ".env.development",
  "id_rsa",
  "id_ed25519",
]);

/**
 * @param {string} rootRaw
 * @returns {string | null} absolute repo root, or null if unset
 */
export function resolveRepoRootAbs(rootRaw) {
  const normalized = normalizeRepoRootForNode(String(rootRaw ?? "").trim());
  if (!normalized) return null;
  return path.resolve(normalized);
}

/**
 * Resolves a path to an absolute path inside repoRootAbs. Rejects escapes and denylisted segments.
 * @param {string} repoRootAbs
 * @param {string} relativeOrAbsPath — model-supplied path (usually relative, e.g. src/foo.ts)
 * @returns {string} absolute normalized path
 */
export function assertPathInRepo(repoRootAbs, relativeOrAbsPath) {
  if (!repoRootAbs) {
    throw new Error("REPO_ROOT not configured");
  }
  const rootNorm = path.resolve(repoRootAbs);
  const raw = String(relativeOrAbsPath ?? "").trim();
  if (!raw || raw.includes("\0")) {
    throw new Error("Invalid path");
  }

  let resolved;
  if (path.isAbsolute(raw)) {
    resolved = path.normalize(raw);
  } else {
    const cleaned = raw.replace(/^[/\\]+/, "");
    resolved = path.resolve(rootNorm, cleaned);
  }

  resolved = path.resolve(resolved);
  const rel = path.relative(rootNorm, resolved);
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    throw new Error(`Path escapes repo root: ${relativeOrAbsPath}`);
  }

  assertNotDenylist(resolved, rootNorm);
  return resolved;
}

/**
 * @param {string} absPath
 * @param {string} rootNorm
 */
function assertNotDenylist(absPath, rootNorm) {
  const rel = path.relative(rootNorm, absPath);
  const parts = rel.split(/[/\\]/).filter(Boolean);
  for (const p of parts) {
    if (DENY_SEGMENTS.has(p)) {
      throw new Error(`Access denied (reserved segment): ${p}`);
    }
  }
  const base = path.basename(absPath);
  if (DENY_BASENAMES.has(base)) {
    throw new Error(`Access denied (file): ${base}`);
  }
  const lower = base.toLowerCase();
  if (lower.endsWith(".pem") || lower.endsWith(".key")) {
    throw new Error("Access denied: key/certificate file");
  }
}

/**
 * Relative POSIX-style path from repo root for display (forward slashes).
 * @param {string} repoRootAbs
 * @param {string} absPath
 */
export function toRepoRelativePath(repoRootAbs, absPath) {
  const rootNorm = path.resolve(repoRootAbs);
  const rel = path.relative(rootNorm, path.resolve(absPath));
  return rel.split(path.sep).join("/");
}
