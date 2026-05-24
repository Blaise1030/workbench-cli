import type Database from "better-sqlite3";

export function runMigrations(sqlite: Database.Database): void {
  sqlite.pragma("foreign_keys = ON");
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      repo_path TEXT NOT NULL UNIQUE,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS worktrees (
      id TEXT PRIMARY KEY NOT NULL,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      path TEXT NOT NULL,
      branch TEXT,
      base_branch TEXT,
      git_dir TEXT,
      is_linked INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL,
      UNIQUE(project_id, path)
    );

    CREATE TABLE IF NOT EXISTS terminals (
      id TEXT PRIMARY KEY NOT NULL,
      worktree_id TEXT NOT NULL REFERENCES worktrees(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      resume_command TEXT,
      resume_trusted INTEGER NOT NULL DEFAULT 0,
      agent_kind TEXT,
      agent_session_id TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);

  addColumnIfMissing(sqlite, "terminals", "resume_command", "TEXT");
  addColumnIfMissing(sqlite, "terminals", "resume_trusted", "INTEGER NOT NULL DEFAULT 0");
  addColumnIfMissing(sqlite, "terminals", "agent_kind", "TEXT");
  addColumnIfMissing(sqlite, "terminals", "agent_session_id", "TEXT");
}

function addColumnIfMissing(
  sqlite: Database.Database,
  table: string,
  column: string,
  definition: string,
): void {
  const columns = sqlite.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  if (columns.some((c) => c.name === column)) return;
  sqlite.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}
