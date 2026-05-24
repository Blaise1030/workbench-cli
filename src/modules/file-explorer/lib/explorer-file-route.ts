import type { RouteLocationRaw } from "vue-router";

/** Full filesystem path for a file inside a worktree. */
export function worktreeFilePath(worktreePath: string, relativePath: string): string {
  const base = worktreePath.endsWith("/") ? worktreePath.slice(0, -1) : worktreePath;
  const rel = relativePath.replace(/^\//, "");
  return `${base}/${rel}`;
}

/** Route to open a file in the file explorer panel. */
export function explorerFileRoute(
  worktreeId: string,
  worktreePath: string,
  relativePath: string,
): RouteLocationRaw {
  return {
    name: "explorer",
    params: { worktreeId },
    query: { file: encodeURIComponent(worktreeFilePath(worktreePath, relativePath)) },
  };
}
