import { applyGitFileAction, type GitFileAction } from "../git/actions.js";
import { commitStagedChanges } from "../git/commit.js";
import { GitError, runGit } from "../git/exec.js";
import { getWorktreeDiff, type GitDiffScope } from "../git/diff.js";
import { parseGitStatusPorcelain } from "../git/status.js";
import { getWorktree, WorktreeError } from "./worktrees.js";
import type { AppDatabase } from "../../db/index.js";

export class GitPanelError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 404 = 400,
  ) {
    super(message);
    this.name = "GitPanelError";
  }
}

async function requireLinkedWorktree(db: AppDatabase["db"], worktreeId: string) {
  const worktree = await getWorktree(db, worktreeId);
  if (!worktree) {
    throw new GitPanelError("Worktree not found", 404);
  }
  if (!worktree.isLinked) {
    throw new GitPanelError("Worktree path is not available on disk", 404);
  }
  return worktree;
}

export async function getGitStatusForWorktree(db: AppDatabase["db"], worktreeId: string) {
  const worktree = await requireLinkedWorktree(db, worktreeId);
  try {
    const raw = runGit(worktree.path, ["status", "--porcelain"], { trim: false });
    const files = parseGitStatusPorcelain(raw);
    const branch = runGit(worktree.path, ["branch", "--show-current"]) || null;
    return { branch, files };
  } catch (err) {
    if (err instanceof GitError) {
      throw new GitPanelError(err.message, 400);
    }
    throw err;
  }
}

export async function getGitDiffForWorktree(
  db: AppDatabase["db"],
  worktreeId: string,
  scope: GitDiffScope,
  path?: string,
) {
  const worktree = await requireLinkedWorktree(db, worktreeId);
  try {
    const patch = getWorktreeDiff(worktree.path, scope, path);
    return { patch, scope, path: path ?? null };
  } catch (err) {
    if (err instanceof GitError) {
      throw new GitPanelError(err.message, 400);
    }
    throw err;
  }
}

export async function applyGitFileActionsForWorktree(
  db: AppDatabase["db"],
  worktreeId: string,
  action: GitFileAction,
  paths: string[],
) {
  const worktree = await requireLinkedWorktree(db, worktreeId);
  try {
    applyGitFileAction(worktree.path, action, paths);
    return { ok: true as const };
  } catch (err) {
    if (err instanceof GitError) {
      throw new GitPanelError(err.message, 400);
    }
    throw err;
  }
}

export async function commitGitForWorktree(
  db: AppDatabase["db"],
  worktreeId: string,
  message: string,
) {
  const worktree = await requireLinkedWorktree(db, worktreeId);
  try {
    commitStagedChanges(worktree.path, message);
    return { ok: true as const };
  } catch (err) {
    if (err instanceof GitError) {
      throw new GitPanelError(err.message, 400);
    }
    throw err;
  }
}
