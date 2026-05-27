use crate::db::Db;
use crate::error::{project_error, AppError, AppResult};
use crate::git::is_git_repo;
use crate::types::{now_iso, Project};
use rusqlite::params;
use std::path::Path;

use super::worktrees::sync_worktrees_for_project;

fn row_to_project(
    id: String,
    name: String,
    repo_path: String,
    created_at: i64,
) -> Project {
    Project {
        id,
        name,
        repo_path,
        created_at: ms_to_iso(created_at),
    }
}

fn ms_to_iso(ms: i64) -> String {
    chrono::DateTime::from_timestamp_millis(ms)
        .map(|dt| dt.to_rfc3339_opts(chrono::SecondsFormat::Millis, true))
        .unwrap_or_else(now_iso)
}

fn now_ms() -> i64 {
    chrono::Utc::now().timestamp_millis()
}

pub fn list_projects(db: &Db) -> AppResult<Vec<Project>> {
    let conn = db.conn();
    let mut stmt = conn
        .prepare("SELECT id, name, repo_path, created_at FROM projects ORDER BY created_at ASC")
        .map_err(|e| AppError::Internal(e.to_string()))?;

    let rows = stmt
        .query_map([], |row| {
            Ok(row_to_project(
                row.get(0)?,
                row.get(1)?,
                row.get(2)?,
                row.get(3)?,
            ))
        })
        .map_err(|e| AppError::Internal(e.to_string()))?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| AppError::Internal(e.to_string()))
}

pub fn get_project(db: &Db, id: &str) -> AppResult<Option<Project>> {
    let conn = db.conn();
    let mut stmt = conn
        .prepare("SELECT id, name, repo_path, created_at FROM projects WHERE id = ?1 LIMIT 1")
        .map_err(|e| AppError::Internal(e.to_string()))?;

    let result = stmt.query_row(params![id], |row| {
        Ok(row_to_project(
            row.get(0)?,
            row.get(1)?,
            row.get(2)?,
            row.get(3)?,
        ))
    });

    match result {
        Ok(project) => Ok(Some(project)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(AppError::Internal(e.to_string())),
    }
}

pub fn register_project(db: &Db, repo_path_input: &str) -> AppResult<Project> {
    let repo_path = Path::new(repo_path_input.trim())
        .canonicalize()
        .map(|p| p.to_string_lossy().into_owned())
        .unwrap_or_else(|_| repo_path_input.trim().to_string());

    if !is_git_repo(&repo_path) {
        return Err(project_error("Path is not a git repository", 400));
    }

    let conn = db.conn();
    let existing: Result<String, _> = conn.query_row(
        "SELECT id FROM projects WHERE repo_path = ?1 LIMIT 1",
        params![repo_path],
        |row| row.get(0),
    );
    if existing.is_ok() {
        return Err(project_error("Project already registered", 400));
    }

    let id = uuid::Uuid::new_v4().to_string();
    let name = Path::new(&repo_path)
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("project")
        .to_string();
    let created_at = now_ms();

    conn.execute(
        "INSERT INTO projects (id, name, repo_path, created_at) VALUES (?1, ?2, ?3, ?4)",
        params![id, name, repo_path, created_at],
    )
    .map_err(|e| AppError::Internal(e.to_string()))?;

    sync_worktrees_for_project(db, &id)?;
    get_project(db, &id)?.ok_or_else(|| AppError::Internal("Project missing after insert".into()))
}

pub fn delete_project(db: &Db, id: &str) -> AppResult<()> {
    if get_project(db, id)?.is_none() {
        return Err(project_error("Project not found", 404));
    }
    db.conn()
        .execute("DELETE FROM projects WHERE id = ?1", params![id])
        .map_err(|e| AppError::Internal(e.to_string()))?;
    Ok(())
}
