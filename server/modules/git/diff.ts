import { runGit } from "./exec.js";

export type GitDiffScope = "all" | "staged" | "unstaged";

export function getWorktreeDiff(
  worktreePath: string,
  scope: GitDiffScope,
  path?: string,
): string {
  const args: string[] = [];
  switch (scope) {
    case "staged":
      args.push("diff", "--cached");
      break;
    case "unstaged":
      args.push("diff");
      break;
    case "all":
      args.push("diff", "HEAD");
      break;
  }
  if (path) {
    args.push("--", path);
  }
  return runGit(worktreePath, args, { trim: false });
}
