import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { eq } from "drizzle-orm";
import type { AppDatabase } from "../../db/index.js";
import { worktrees } from "../../db/schema.js";
import { GitError } from "../git/exec.js";
import { createWorktree } from "../git/worktree-create.js";
import {
  listWorktrees as gitListWorktrees,
  worktreePathExists,
} from "../git/worktree-list.js";
import { removeWorktree as gitRemoveWorktree } from "../git/worktree-remove.js";
import { getProject, ProjectError } from "./projects.js";

export class WorktreeError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 404 = 400,
  ) {
    super(message);
    this.name = "WorktreeError";
  }
}

export async function getWorktree(db: AppDatabase["db"], id: string) {
  const rows = await db.select().from(worktrees).where(eq(worktrees.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function syncWorktreesForProject(db: AppDatabase["db"], projectId: string) {
  const project = await getProject(db, projectId);
  if (!project) throw new ProjectError("Project not found", 404);

  const gitEntries = gitListWorktrees(project.repoPath);

  const existing = await db
    .select()
    .from(worktrees)
    .where(eq(worktrees.projectId, projectId));

  const byPath = new Map(existing.map((w) => [w.path, w]));

  for (const entry of gitEntries) {
    const linked = worktreePathExists(entry.path);
    const prev = byPath.get(entry.path);
    if (prev) {
      await db
        .update(worktrees)
        .set({
          branch: entry.branch ?? prev.branch,
          gitDir: entry.gitDir ?? prev.gitDir,
          isLinked: linked,
        })
        .where(eq(worktrees.id, prev.id));
      byPath.delete(entry.path);
    } else {
      await db.insert(worktrees).values({
        id: randomUUID(),
        projectId,
        path: entry.path,
        branch: entry.branch ?? null,
        baseBranch: null,
        gitDir: entry.gitDir ?? null,
        isLinked: linked,
        createdAt: new Date(),
      });
    }
  }

  for (const orphan of byPath.values()) {
    await db
      .update(worktrees)
      .set({ isLinked: false })
      .where(eq(worktrees.id, orphan.id));
  }
}

export async function listWorktreesByProject(db: AppDatabase["db"], projectId: string) {
  const project = await getProject(db, projectId);
  if (!project) throw new ProjectError("Project not found", 404);
  await syncWorktreesForProject(db, projectId);
  return db.select().from(worktrees).where(eq(worktrees.projectId, projectId));
}

export interface CreateWorktreeBody {
  branch: string;
  baseBranch?: string;
  path?: string;
  isNewBranch?: boolean;
}

export async function createWorktreeForProject(
  db: AppDatabase["db"],
  projectId: string,
  body: CreateWorktreeBody,
) {
  const project = await getProject(db, projectId);
  if (!project) throw new ProjectError("Project not found", 404);

  try {
    const result = createWorktree({
      repoPath: project.repoPath,
      branch: body.branch.trim(),
      baseBranch: body.baseBranch?.trim(),
      path: body.path?.trim(),
      isNewBranch: body.isNewBranch,
    });

    await syncWorktreesForProject(db, projectId);
    const rows = await db
      .select()
      .from(worktrees)
      .where(eq(worktrees.projectId, projectId));
    const match = rows.find((w) => w.path === result.path);
    if (!match) {
      throw new WorktreeError("Worktree created but not found after sync");
    }

    if (result.baseBranch) {
      await db
        .update(worktrees)
        .set({ baseBranch: result.baseBranch })
        .where(eq(worktrees.id, match.id));
    }

    return (await getWorktree(db, match.id))!;
  } catch (err) {
    if (err instanceof GitError) {
      throw new WorktreeError(err.message);
    }
    throw err;
  }
}

export async function deleteWorktree(db: AppDatabase["db"], id: string) {
  const row = await getWorktree(db, id);
  if (!row) throw new WorktreeError("Worktree not found", 404);

  const project = await getProject(db, row.projectId);
  if (!project) throw new WorktreeError("Project not found", 404);

  if (resolve(project.repoPath) === resolve(row.path)) {
    throw new WorktreeError("Cannot remove the main worktree", 400);
  }

  if (worktreePathExists(row.path)) {
    try {
      gitRemoveWorktree(project.repoPath, row.path, { force: true });
    } catch (err) {
      if (err instanceof GitError) {
        throw new WorktreeError(err.message);
      }
      throw err;
    }
  }

  await db.delete(worktrees).where(eq(worktrees.id, id));
}
