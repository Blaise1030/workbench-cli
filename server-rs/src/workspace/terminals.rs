use crate::db::Db;
use crate::error::{terminal_error, worktree_error, AppError, AppResult};
use crate::git::worktree_path_exists;
use crate::types::{now_iso, Terminal, Worktree};
use rusqlite::params;

use super::worktrees::get_worktree;

fn ms_to_iso(ms: i64) -> String {
    chrono::DateTime::from_timestamp_millis(ms)
        .map(|dt| dt.to_rfc3339_opts(chrono::SecondsFormat::Millis, true))
        .unwrap_or_else(now_iso)
}

fn now_ms() -> i64 {
    chrono::Utc::now().timestamp_millis()
}

fn row_to_terminal(
    id: String,
    worktree_id: String,
    title: String,
    sort_order: i64,
    resume_command: Option<String>,
    resume_trusted: i64,
    agent_kind: Option<String>,
    agent_session_id: Option<String>,
    created_at: i64,
) -> Terminal {
    Terminal {
        id,
        worktree_id,
        title,
        sort_order,
        resume_command,
        resume_trusted: resume_trusted != 0,
        agent_kind,
        agent_session_id,
        created_at: ms_to_iso(created_at),
    }
}

pub struct TerminalWithWorktree {
    pub terminal: Terminal,
    pub worktree: Worktree,
}

pub fn list_terminals(db: &Db, worktree_id: &str) -> AppResult<Vec<Terminal>> {
    if get_worktree(db, worktree_id)?.is_none() {
        return Err(worktree_error("Worktree not found", 404));
    }

    let conn = db.conn();
    let mut stmt = conn
        .prepare(
            "SELECT id, worktree_id, title, sort_order, resume_command, resume_trusted,
                    agent_kind, agent_session_id, created_at
             FROM terminals WHERE worktree_id = ?1
             ORDER BY sort_order ASC, created_at ASC",
        )
        .map_err(|e| AppError::Internal(e.to_string()))?;

    let rows = stmt
        .query_map(params![worktree_id], |row| {
            Ok(row_to_terminal(
                row.get(0)?,
                row.get(1)?,
                row.get(2)?,
                row.get(3)?,
                row.get(4)?,
                row.get(5)?,
                row.get(6)?,
                row.get(7)?,
                row.get(8)?,
            ))
        })
        .map_err(|e| AppError::Internal(e.to_string()))?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| AppError::Internal(e.to_string()))
}

pub fn create_terminal(db: &Db, worktree_id: &str, title: Option<&str>) -> AppResult<Terminal> {
    if get_worktree(db, worktree_id)?.is_none() {
        return Err(worktree_error("Worktree not found", 404));
    }

    let existing = list_terminals(db, worktree_id)?;
    let id = uuid::Uuid::new_v4().to_string();
    let resolved_title = title
        .map(str::trim)
        .filter(|t| !t.is_empty())
        .map(str::to_string)
        .unwrap_or_else(|| format!("Terminal {}", existing.len() + 1));
    let sort_order = existing.len() as i64;
    let created_at = now_ms();

    db.conn()
        .execute(
            "INSERT INTO terminals (id, worktree_id, title, sort_order, resume_command, resume_trusted, agent_kind, agent_session_id, created_at)
             VALUES (?1, ?2, ?3, ?4, NULL, 0, NULL, NULL, ?5)",
            params![id, worktree_id, resolved_title, sort_order, created_at],
        )
        .map_err(|e| AppError::Internal(e.to_string()))?;

    get_terminal(db, &id)?.ok_or_else(|| AppError::Internal("Terminal missing after insert".into()))
}

pub fn get_terminal(db: &Db, id: &str) -> AppResult<Option<Terminal>> {
    let conn = db.conn();
    let mut stmt = conn
        .prepare(
            "SELECT id, worktree_id, title, sort_order, resume_command, resume_trusted,
                    agent_kind, agent_session_id, created_at
             FROM terminals WHERE id = ?1 LIMIT 1",
        )
        .map_err(|e| AppError::Internal(e.to_string()))?;

    let result = stmt.query_row(params![id], |row| {
        Ok(row_to_terminal(
            row.get(0)?,
            row.get(1)?,
            row.get(2)?,
            row.get(3)?,
            row.get(4)?,
            row.get(5)?,
            row.get(6)?,
            row.get(7)?,
            row.get(8)?,
        ))
    });

    match result {
        Ok(terminal) => Ok(Some(terminal)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(AppError::Internal(e.to_string())),
    }
}

pub fn get_terminal_with_worktree(db: &Db, id: &str) -> AppResult<Option<TerminalWithWorktree>> {
    let terminal = match get_terminal(db, id)? {
        Some(t) => t,
        None => return Ok(None),
    };
    let worktree = match get_worktree(db, &terminal.worktree_id)? {
        Some(w) => w,
        None => return Ok(None),
    };
    if !worktree_path_exists(&worktree.path) {
        return Err(terminal_error("Worktree path no longer exists on disk", 404));
    }
    Ok(Some(TerminalWithWorktree { terminal, worktree }))
}

pub struct UpdateTerminalPatch {
    pub title: Option<String>,
    pub sort_order: Option<i64>,
    pub resume_command: Option<Option<String>>,
    pub resume_trusted: Option<bool>,
}

pub fn update_terminal(db: &Db, id: &str, patch: &UpdateTerminalPatch) -> AppResult<Terminal> {
    let row = get_terminal(db, id)?
        .ok_or_else(|| terminal_error("Terminal not found", 404))?;

    let mut title = row.title.clone();
    let mut sort_order = row.sort_order;
    let mut resume_command = row.resume_command.clone();
    let mut resume_trusted = row.resume_trusted;

    if let Some(ref t) = patch.title {
        title = t.trim().to_string();
        if title.is_empty() {
            title = row.title;
        }
    }
    if let Some(so) = patch.sort_order {
        sort_order = so;
    }
    if let Some(ref rc) = patch.resume_command {
        resume_command = rc.as_ref().and_then(|s| {
            let trimmed = s.trim();
            if trimmed.is_empty() {
                None
            } else {
                Some(trimmed.to_string())
            }
        });
        if resume_command.is_none() {
            resume_trusted = false;
        }
    }
    if let Some(rt) = patch.resume_trusted {
        resume_trusted = rt;
    }

    db.conn()
        .execute(
            "UPDATE terminals SET title = ?1, sort_order = ?2, resume_command = ?3, resume_trusted = ?4 WHERE id = ?5",
            params![title, sort_order, resume_command, resume_trusted as i64, id],
        )
        .map_err(|e| AppError::Internal(e.to_string()))?;

    get_terminal(db, id)?.ok_or_else(|| terminal_error("Terminal not found", 404))
}

pub fn update_terminal_agent_session(
    db: &Db,
    id: &str,
    agent_kind: &str,
    agent_session_id: &str,
) -> AppResult<Terminal> {
    if get_terminal(db, id)?.is_none() {
        return Err(terminal_error("Terminal not found", 404));
    }
    db.conn()
        .execute(
            "UPDATE terminals SET agent_kind = ?1, agent_session_id = ?2 WHERE id = ?3",
            params![agent_kind, agent_session_id, id],
        )
        .map_err(|e| AppError::Internal(e.to_string()))?;
    get_terminal(db, id)?.ok_or_else(|| terminal_error("Terminal not found", 404))
}

pub fn clear_terminal_agent_session(db: &Db, id: &str) -> AppResult<()> {
    if get_terminal(db, id)?.is_none() {
        return Err(terminal_error("Terminal not found", 404));
    }
    db.conn()
        .execute(
            "UPDATE terminals SET agent_kind = NULL, agent_session_id = NULL WHERE id = ?1",
            params![id],
        )
        .map_err(|e| AppError::Internal(e.to_string()))?;
    Ok(())
}

pub fn delete_terminal(db: &Db, id: &str) -> AppResult<()> {
    if get_terminal(db, id)?.is_none() {
        return Err(terminal_error("Terminal not found", 404));
    }
    db.conn()
        .execute("DELETE FROM terminals WHERE id = ?1", params![id])
        .map_err(|e| AppError::Internal(e.to_string()))?;
    Ok(())
}
