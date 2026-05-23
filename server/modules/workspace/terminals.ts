import { randomUUID } from "node:crypto";
import { asc, eq } from "drizzle-orm";
import type { AppDatabase } from "../../db/index.js";
import { terminals } from "../../db/schema.js";
import { worktreePathExists } from "../git/worktree-list.js";
import { getWorktree, WorktreeError } from "./worktrees.js";

export class TerminalError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 404 = 400,
  ) {
    super(message);
    this.name = "TerminalError";
  }
}

export async function listTerminals(db: AppDatabase["db"], worktreeId: string) {
  const wt = await getWorktree(db, worktreeId);
  if (!wt) throw new WorktreeError("Worktree not found", 404);
  return db
    .select()
    .from(terminals)
    .where(eq(terminals.worktreeId, worktreeId))
    .orderBy(asc(terminals.sortOrder), asc(terminals.createdAt));
}

export async function createTerminal(
  db: AppDatabase["db"],
  worktreeId: string,
  title?: string,
) {
  const wt = await getWorktree(db, worktreeId);
  if (!wt) throw new WorktreeError("Worktree not found", 404);

  const existing = await listTerminals(db, worktreeId);
  const id = randomUUID();
  const resolvedTitle = title?.trim() || `Terminal ${existing.length + 1}`;
  const row = {
    id,
    worktreeId,
    title: resolvedTitle,
    sortOrder: existing.length,
    createdAt: new Date(),
  };
  await db.insert(terminals).values(row);
  return row;
}

export async function getTerminal(db: AppDatabase["db"], id: string) {
  const rows = await db.select().from(terminals).where(eq(terminals.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function getTerminalWithWorktree(db: AppDatabase["db"], id: string) {
  const terminal = await getTerminal(db, id);
  if (!terminal) return null;
  const worktree = await getWorktree(db, terminal.worktreeId);
  if (!worktree) return null;
  if (!worktreePathExists(worktree.path)) {
    throw new TerminalError("Worktree path no longer exists on disk", 404);
  }
  return { terminal, worktree };
}

export async function updateTerminal(
  db: AppDatabase["db"],
  id: string,
  patch: { title?: string; sortOrder?: number },
) {
  const row = await getTerminal(db, id);
  if (!row) throw new TerminalError("Terminal not found", 404);
  const updates: Partial<{ title: string; sortOrder: number }> = {};
  if (patch.title !== undefined) updates.title = patch.title.trim() || row.title;
  if (patch.sortOrder !== undefined) updates.sortOrder = patch.sortOrder;
  if (Object.keys(updates).length > 0) {
    await db.update(terminals).set(updates).where(eq(terminals.id, id));
  }
  return (await getTerminal(db, id))!;
}

export async function deleteTerminal(db: AppDatabase["db"], id: string) {
  const row = await getTerminal(db, id);
  if (!row) throw new TerminalError("Terminal not found", 404);
  await db.delete(terminals).where(eq(terminals.id, id));
}
