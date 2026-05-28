package db

import "database/sql"

const schema = `
PRAGMA foreign_keys = ON;

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
`

var addColumns = []struct {
	table, column, def string
}{
	{"terminals", "resume_command", "TEXT"},
	{"terminals", "resume_trusted", "INTEGER NOT NULL DEFAULT 0"},
	{"terminals", "agent_kind", "TEXT"},
	{"terminals", "agent_session_id", "TEXT"},
}

func Migrate(db *sql.DB) error {
	if _, err := db.Exec("PRAGMA foreign_keys = ON"); err != nil {
		return err
	}
	if _, err := db.Exec(schema); err != nil {
		return err
	}
	for _, c := range addColumns {
		if err := addColumnIfMissing(db, c.table, c.column, c.def); err != nil {
			return err
		}
	}
	return nil
}

func addColumnIfMissing(db *sql.DB, table, column, def string) error {
	rows, err := db.Query(`PRAGMA table_info(` + table + `)`)
	if err != nil {
		return err
	}
	defer rows.Close()
	for rows.Next() {
		var cid int
		var name, colType string
		var notNull, pk int
		var dfltVal any
		if err := rows.Scan(&cid, &name, &colType, &notNull, &dfltVal, &pk); err != nil {
			return err
		}
		if name == column {
			return nil
		}
	}
	_, err = db.Exec(`ALTER TABLE ` + table + ` ADD COLUMN ` + column + ` ` + def)
	return err
}
