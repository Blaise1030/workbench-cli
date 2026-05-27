use crate::db::Db;
use crate::error::{project_error, worktree_error, AppError, AppResult};
use crate::git::{
    create_worktree, list_worktrees as git_list_worktrees, worktree_path_exists, CreateWorktreeInput,
    GitError,
};
use crate::types::{now_iso, Worktree};
use rusqlite::params;

use super::projects::get_project;

fn ms_to_iso(ms: i64) -> String {
    chrono::DateTime::from_timestamp_millis(ms)
        .map(|dt| dt.to_rfc3339_opts(chrono::SecondsFormat::Millis, true))
        .unwrap_or_else(now_iso)
}

fn now_ms() -> i64 {
    chrono::Utc::now().timestamp_millis()
}

fn row_to_worktree(
    id: String,
    project_id: String,
    path: String,
    branch: Option<String>,
    base_branch: Option<String>,
    git_dir: Option<String>,
    is_linked: i64,
    created_at: i64,
) -> Worktree {
    Worktree {
        id,
        project_id,
        path,
        branch,
        base_branch,
        git_dir,
        is_linked: is_linked != 0,
        created_at: ms_to_iso(created_at),
    }
}

fn fetch_worktree(db: &Db, id: &str) -> AppResult<Option<Worktree>> {
    let conn = db.conn();
    let mut stmt = conn
        .prepare(
            "SELECT id, project_id, path, branch, base_branch, git_dir, is_linked, created_at
             FROM worktrees WHERE id = ?1 LIMIT 1",
        )
        .map_err(|e| AppError::Internal(e.to_string()))?;

    let result = stmt.query_row(params![id], |row| {
        Ok(row_to_worktree(
            row.get(0)?,
            row.get(1)?,
            row.get(2)?,
            row.get(3)?,
            row.get(4)?,
            row.get(5)?,
            row.get(6)?,
            row.get(7)?,
        ))
    });

    match result {
        Ok(wt) => Ok(Some(wt)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(AppError::Internal(e.to_string())),
    }
}

pub fn get_worktree(db: &Db, id: &str) -> AppResult<Option<Worktree>> {
    fetch_worktree(db, id)
}

pub fn sync_worktrees_for_project(db: &Db, project_id: &str) -> AppResult<()> {
    let project = get_project(db, project_id)?
        .ok_or_else(|| project_error("Project not found", 404))?;

    let git_entries = git_list_worktrees(&project.repo_path)
        .map_err(|e| AppError::Internal(e.message))?;

    let conn = db.conn();
    let mut stmt = conn
        .prepare(
            "SELECT id, project_id, path, branch, base_branch, git_dir, is_linked, created_at
             FROM worktrees WHERE project_id = ?1",
        )
        .map_err(|e| AppError::Internal(e.to_string()))?;

    let existing = stmt
        .query_map(params![project_id], |row| {
            Ok(row_to_worktree(
                row.get(0)?,
                row.get(1)?,
                row.get(2)?,
                row.get(3)?,
                row.get(4)?,
                row.get(5)?,
                row.get(6)?,
                row.get(7)?,
            ))
        })
        .map_err(|e| AppError::Internal(e.to_string()))?
        .collect::<Result<Vec<Worktree>, _>>()
        .map_err(|e| AppError::Internal(e.to_string()))?;

    let mut by_path: std::collections::HashMap<String, Worktree> = existing
        .into_iter()
        .map(|wt| (wt.path.clone(), wt))
        .collect();

    for entry in git_entries {
        let linked = worktree_path_exists(&entry.path);
        if let Some(prev) = by_path.remove(&entry.path) {
            let branch = entry.branch.or(prev.branch);
            let git_dir = entry.git_dir.or(prev.git_dir);
            conn.execute(
                "UPDATE worktrees SET branch = ?1, git_dir = ?2, is_linked = ?3 WHERE id = ?4",
                params![branch, git_dir, linked as i64, prev.id],
            )
            .map_err(|e| AppError::Internal(e.to_string()))?;
        } else {
            let id = uuid::Uuid::new_v4().to_string();
            let created_at = now_ms();
            conn.execute(
                "INSERT INTO worktrees (id, project_id, path, branch, base_branch, git_dir, is_linked, created_at)
                 VALUES (?1, ?2, ?3, ?4, NULL, ?5, ?6, ?7)",
                params![
                    id,
                    project_id,
                    entry.path,
                    entry.branch,
                    entry.git_dir,
                    linked as i64,
                    created_at,
                ],
            )
            .map_err(|e| AppError::Internal(e.to_string()))?;
        }
    }

    for orphan in by_path.values() {
        conn.execute(
            "UPDATE worktrees SET is_linked = 0 WHERE id = ?1",
            params![orphan.id],
        )
        .map_err(|e| AppError::Internal(e.to_string()))?;
    }

    Ok(())
}

pub fn list_worktrees_by_project(db: &Db, project_id: &str) -> AppResult<Vec<Worktree>> {
    if get_project(db, project_id)?.is_none() {
        return Err(project_error("Project not found", 404));
    }
    sync_worktrees_for_project(db, project_id)?;

    let conn = db.conn();
    let mut stmt = conn
        .prepare(
            "SELECT id, project_id, path, branch, base_branch, git_dir, is_linked, created_at
             FROM worktrees WHERE project_id = ?1",
        )
        .map_err(|e| AppError::Internal(e.to_string()))?;

    let rows = stmt
        .query_map(params![project_id], |row| {
            Ok(row_to_worktree(
                row.get(0)?,
                row.get(1)?,
                row.get(2)?,
                row.get(3)?,
                row.get(4)?,
                row.get(5)?,
                row.get(6)?,
                row.get(7)?,
            ))
        })
        .map_err(|e| AppError::Internal(e.to_string()))?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| AppError::Internal(e.to_string()))
}

pub fn create_worktree_for_project(
    db: &Db,
    project_id: &str,
    branch: &str,
    base_branch: Option<&str>,
    path: Option<&str>,
    is_new_branch: Option<bool>,
) -> AppResult<Worktree> {
    let project = get_project(db, project_id)?
        .ok_or_else(|| project_error("Project not found", 404))?;

    let result = create_worktree(&CreateWorktreeInput {
        repo_path: &project.repo_path,
        branch: branch.trim(),
        base_branch: base_branch.map(str::trim),
        path: path.map(str::trim),
        is_new_branch,
    })
    .map_err(|e: GitError| worktree_error(e.message, 400))?;

    sync_worktrees_for_project(db, project_id)?;

    let conn = db.conn();
    let mut stmt = conn
        .prepare(
            "SELECT id, project_id, path, branch, base_branch, git_dir, is_linked, created_at
             FROM worktrees WHERE project_id = ?1",
        )
        .map_err(|e| AppError::Internal(e.to_string()))?;

    let rows = stmt
        .query_map(params![project_id], |row| {
            Ok(row_to_worktree(
                row.get(0)?,
                row.get(1)?,
                row.get(2)?,
                row.get(3)?,
                row.get(4)?,
                row.get(5)?,
                row.get(6)?,
                row.get(7)?,
            ))
        })
        .map_err(|e| AppError::Internal(e.to_string()))?;

    let worktrees: Vec<Worktree> = rows
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| AppError::Internal(e.to_string()))?;

    let matched = worktrees
        .into_iter()
        .find(|w| w.path == result.path)
        .ok_or_else(|| worktree_error("Worktree created but not found after sync", 400))?;

    if let Some(ref base) = result.base_branch {
        conn.execute(
            "UPDATE worktrees SET base_branch = ?1 WHERE id = ?2",
            params![base, matched.id],
        )
        .map_err(|e| AppError::Internal(e.to_string()))?;
    }

    fetch_worktree(db, &matched.id)?
        .ok_or_else(|| worktree_error("Worktree not found", 404))
}

pub fn delete_worktree(db: &Db, id: &str) -> AppResult<()> {
    if fetch_worktree(db, id)?.is_none() {
        return Err(worktree_error("Worktree not found", 404));
    }
    db.conn()
        .execute("DELETE FROM worktrees WHERE id = ?1", params![id])
        .map_err(|e| AppError::Internal(e.to_string()))?;
    Ok(())
}
