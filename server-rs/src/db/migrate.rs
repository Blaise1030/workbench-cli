use rusqlite::Connection;

const MIGRATION_SQL: &str = r#"
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
"#;

pub fn run_migrations(conn: &Connection) -> rusqlite::Result<()> {
    conn.pragma_update(None, "foreign_keys", "ON")?;
    conn.execute_batch(MIGRATION_SQL)?;

    add_column_if_missing(conn, "terminals", "resume_command", "TEXT")?;
    add_column_if_missing(conn, "terminals", "resume_trusted", "INTEGER NOT NULL DEFAULT 0")?;
    add_column_if_missing(conn, "terminals", "agent_kind", "TEXT")?;
    add_column_if_missing(conn, "terminals", "agent_session_id", "TEXT")?;

    Ok(())
}

fn add_column_if_missing(
    conn: &Connection,
    table: &str,
    column: &str,
    definition: &str,
) -> rusqlite::Result<()> {
    let mut stmt = conn.prepare(&format!("PRAGMA table_info({table})"))?;
    let columns = stmt.query_map([], |row| row.get::<_, String>(1))?;

    for name in columns {
        if name? == column {
            return Ok(());
        }
    }

    conn.execute_batch(&format!(
        "ALTER TABLE {table} ADD COLUMN {column} {definition}"
    ))?;
    Ok(())
}
