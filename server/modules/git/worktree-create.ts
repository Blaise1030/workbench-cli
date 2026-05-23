import { basename, join, resolve } from "node:path";
import { GitError, runGit } from "./exec.js";
import { branchExists } from "./worktree-list.js";

export interface CreateWorktreeInput {
  repoPath: string;
  branch: string;
  baseBranch?: string;
  path?: string;
  isNewBranch?: boolean;
}

export interface CreateWorktreeResult {
  path: string;
  branch: string;
  baseBranch: string | null;
}

function defaultWorktreePath(repoPath: string, branch: string): string {
  const parent = resolve(repoPath, "..");
  const repoName = basename(repoPath);
  const safeBranch = branch.replace(/\//g, "-");
  return join(parent, `${repoName}-${safeBranch}`);
}

export function createWorktree(input: CreateWorktreeInput): CreateWorktreeResult {
  const { repoPath, branch } = input;
  const exists = branchExists(repoPath, branch);
  const wantsNew = input.isNewBranch === true || (!exists && Boolean(input.baseBranch));

  if (!exists && !wantsNew && !input.baseBranch) {
    throw new GitError(
      `Branch "${branch}" does not exist. Choose a base branch to create it from.`,
      "",
    );
  }

  const targetPath = resolve(
    input.path?.trim() || defaultWorktreePath(repoPath, branch),
  );

  if (wantsNew) {
    const baseBranch = input.baseBranch?.trim();
    if (!baseBranch) {
      throw new GitError("baseBranch is required when creating a new branch", "");
    }
    if (!branchExists(repoPath, baseBranch)) {
      throw new GitError(`Base branch "${baseBranch}" does not exist`, "");
    }
    if (exists) {
      throw new GitError(`Branch "${branch}" already exists`, "");
    }
    runGit(repoPath, ["worktree", "add", "-b", branch, targetPath, baseBranch]);
    return { path: targetPath, branch, baseBranch };
  }

  if (!exists) {
    throw new GitError(`Branch "${branch}" does not exist`, "");
  }

  runGit(repoPath, ["worktree", "add", targetPath, branch]);
  return { path: targetPath, branch, baseBranch: null };
}
