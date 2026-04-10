import path from "node:path";

/**
 * Git Bash uses /c/Users/... ; Node on Windows expects C:\Users\...
 * Centralizes platform-specific path normalization for reuse across scripts.
 */
export function normalizeRepoRootForNode(root) {
  const t = root.trim();
  if (!t) return t;
  if (process.platform === "win32") {
    const m = t.match(/^\/([a-z])(\/.*)?$/i);
    if (m) {
      const rest = m[2] ?? "";
      return `${m[1].toUpperCase()}:${rest.replace(/\//g, path.sep)}`;
    }
  }
  return t;
}
