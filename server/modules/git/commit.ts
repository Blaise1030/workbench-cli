import { GitError, runGit } from "./exec.js";
import { parseGitStatusPorcelain } from "./status.js";

export function hasStagedChanges(worktreePath: string): boolean {
  const raw = runGit(worktreePath, ["status", "--porcelain"], { trim: false });
  const entries = parseGitStatusPorcelain(raw);
  return entries.some((entry) => entry.staged != null);
}

export function commitStagedChanges(worktreePath: string, message: string): void {
  const trimmed = message.trim();
  if (!trimmed) {
    throw new GitError("Commit message is required", "");
  }
  if (!hasStagedChanges(worktreePath)) {
    throw new GitError("Nothing staged to commit", "");
  }
  runGit(worktreePath, ["commit", "-m", trimmed]);
}
