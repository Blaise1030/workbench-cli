import { runGit } from "./exec.js";
import { parseGitStatusPorcelain, type GitStatusEntry } from "./status.js";

export type GitFileAction = "stage" | "unstage" | "discard";

function statusByPath(entries: GitStatusEntry[]): Map<string, GitStatusEntry> {
  return new Map(entries.map((entry) => [entry.path, entry]));
}

export function pathsForAction(
  action: GitFileAction,
  paths: string[],
  entries: GitStatusEntry[],
): string[] {
  const byPath = statusByPath(entries);
  switch (action) {
    case "stage":
      return paths.filter((path) => byPath.get(path)?.unstaged != null);
    case "unstage":
      return paths.filter((path) => byPath.get(path)?.staged != null);
    case "discard": {
      return paths.filter((path) => {
        const entry = byPath.get(path);
        return entry?.unstaged != null;
      });
    }
  }
}

export function applyGitFileAction(
  worktreePath: string,
  action: GitFileAction,
  paths: string[],
): void {
  if (!paths.length) return;

  const raw = runGit(worktreePath, ["status", "--porcelain"], { trim: false });
  const entries = parseGitStatusPorcelain(raw);
  const applicable = pathsForAction(action, paths, entries);
  if (!applicable.length) return;

  const byPath = statusByPath(entries);

  switch (action) {
    case "stage":
      runGit(worktreePath, ["add", "--", ...applicable]);
      return;
    case "unstage":
      runGit(worktreePath, ["restore", "--staged", "--", ...applicable]);
      return;
    case "discard": {
      const tracked: string[] = [];
      const untracked: string[] = [];
      for (const path of applicable) {
        const entry = byPath.get(path);
        if (entry?.unstaged === "untracked") untracked.push(path);
        else tracked.push(path);
      }
      if (tracked.length) {
        runGit(worktreePath, ["restore", "--worktree", "--", ...tracked]);
      }
      if (untracked.length) {
        runGit(worktreePath, ["clean", "-fd", "--", ...untracked]);
      }
      return;
    }
  }
}
