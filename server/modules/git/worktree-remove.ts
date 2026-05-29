import { GitError, runGit } from "./exec.js";

export function removeWorktree(
  repoPath: string,
  worktreePath: string,
  options?: { force?: boolean },
): void {
  const args = ["worktree", "remove"];
  if (options?.force) args.push("--force");
  args.push(worktreePath);
  runGit(repoPath, args);
}
