import { statSync } from "node:fs";
import { devNull } from "node:os";
import { join } from "node:path";
import { runGit, runGitWithStdout } from "./exec.js";

export type GitDiffScope = "all" | "staged" | "unstaged" | "untracked";

/** Untracked file paths (not directories) under the worktree. */
export function listUntrackedFilePaths(
  worktreePath: string,
  path?: string,
): string[] {
  const raw = runGit(worktreePath, ["ls-files", "--others", "--exclude-standard"], {
    trim: false,
  });
  let paths = raw.split("\n").filter((line) => line.length > 0);

  if (path) {
    paths = paths.filter(
      (entryPath) =>
        entryPath === path || entryPath.startsWith(`${path}/`),
    );
  }

  return paths.filter((filePath) => {
    try {
      return statSync(join(worktreePath, filePath)).isFile();
    } catch {
      return false;
    }
  });
}

function getUntrackedWorktreeDiff(worktreePath: string, path?: string): string {
  const patches: string[] = [];
  for (const filePath of listUntrackedFilePaths(worktreePath, path)) {
    try {
      const patch = runGitWithStdout(
        worktreePath,
        ["diff", "--no-index", "--", devNull, filePath],
        { trim: false },
      );
      if (patch.trim()) {
        patches.push(patch);
      }
    } catch {
      // Skip unreadable paths; do not fail the whole diff request.
    }
  }
  return patches.join("\n");
}

function joinPatches(...parts: string[]): string {
  const nonEmpty = parts.filter((part) => part.trim().length > 0);
  return nonEmpty.join("\n");
}

export function getWorktreeDiff(
  worktreePath: string,
  scope: GitDiffScope,
  path?: string,
): string {
  if (scope === "untracked") {
    return getUntrackedWorktreeDiff(worktreePath, path);
  }

  const args: string[] = [];
  switch (scope) {
    case "staged":
      args.push("diff", "--cached");
      break;
    case "unstaged": {
      const unstagedPatch = runGitWithStdout(
        worktreePath,
        ["diff", ...(path ? ["--", path] : [])],
        { trim: false },
      );
      const untrackedPatch = getUntrackedWorktreeDiff(worktreePath, path);
      return joinPatches(unstagedPatch, untrackedPatch);
    }
    case "all":
      args.push("diff", "HEAD");
      break;
  }
  if (path) {
    args.push("--", path);
  }
  return runGitWithStdout(worktreePath, args, { trim: false });
}
