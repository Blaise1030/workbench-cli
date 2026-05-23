import { randomUUID } from "node:crypto";
import { basename, resolve } from "node:path";
import { asc, eq } from "drizzle-orm";
import type { AppDatabase } from "../../db/index.js";
import { projects } from "../../db/schema.js";
import { isGitRepo } from "../git/exec.js";
import { syncWorktreesForProject } from "./worktrees.js";

export class ProjectError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 404 = 400,
  ) {
    super(message);
    this.name = "ProjectError";
  }
}

export function listProjects(db: AppDatabase["db"]) {
  return db.select().from(projects).orderBy(asc(projects.createdAt));
}

export async function getProject(db: AppDatabase["db"], id: string) {
  const rows = await db.select().from(projects).where(eq(projects.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function registerProject(db: AppDatabase["db"], repoPathInput: string) {
  const repoPath = resolve(repoPathInput.trim());
  if (!isGitRepo(repoPath)) {
    throw new ProjectError("Path is not a git repository");
  }

  const existing = await db
    .select()
    .from(projects)
    .where(eq(projects.repoPath, repoPath))
    .limit(1);
  if (existing[0]) {
    throw new ProjectError("Project already registered");
  }

  const id = randomUUID();
  const name = basename(repoPath);
  const createdAt = new Date();
  await db.insert(projects).values({ id, name, repoPath, createdAt });
  await syncWorktreesForProject(db, id);
  const project = await getProject(db, id);
  return project!;
}

export async function deleteProject(db: AppDatabase["db"], id: string) {
  const project = await getProject(db, id);
  if (!project) throw new ProjectError("Project not found", 404);
  await db.delete(projects).where(eq(projects.id, id));
}
