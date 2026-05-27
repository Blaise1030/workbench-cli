use crate::db::Db;
use crate::error::{git_panel_error, AppError, AppResult};
use crate::git::{
    apply_git_file_action, commit_staged_changes, get_worktree_diff, parse_git_status_porcelain,
    run_git, GitDiffScope, GitError, GitFileAction, RunGitOptions,
};
use crate::types::GitStatusEntry;

use serde::Serialize;

use super::worktrees::get_worktree;

#[derive(Serialize)]
pub struct GitStatusResponse {
    pub branch: Option<String>,
    pub files: Vec<GitStatusEntry>,
}

#[derive(Serialize)]
pub struct GitDiffResponse {
    pub patch: String,
    pub scope: String,
    pub path: Option<String>,
}

fn require_linked_worktree(db: &Db, worktree_id: &str) -> AppResult<crate::types::Worktree> {
    let worktree = get_worktree(db, worktree_id)?
        .ok_or_else(|| git_panel_error("Worktree not found", 404))?;
    if !worktree.is_linked {
        return Err(git_panel_error("Worktree path is not available on disk", 404));
    }
    Ok(worktree)
}

pub fn get_git_status_for_worktree(db: &Db, worktree_id: &str) -> AppResult<GitStatusResponse> {
    let worktree = require_linked_worktree(db, worktree_id)?;
    let raw = run_git(
        &worktree.path,
        &["status", "--porcelain"],
        Some(RunGitOptions { trim: false }),
    )
    .map_err(|e: GitError| git_panel_error(e.message, 400))?;
    let files = parse_git_status_porcelain(&raw);
    let branch = run_git(&worktree.path, &["branch", "--show-current"], None)
        .ok()
        .filter(|b| !b.is_empty());
    Ok(GitStatusResponse { branch, files })
}

pub fn get_git_diff_for_worktree(
    db: &Db,
    worktree_id: &str,
    scope: GitDiffScope,
    path: Option<&str>,
) -> AppResult<GitDiffResponse> {
    let worktree = require_linked_worktree(db, worktree_id)?;
    let patch = get_worktree_diff(&worktree.path, scope, path)
        .map_err(|e: GitError| git_panel_error(e.message, 400))?;
    let scope_str = match scope {
        GitDiffScope::All => "all",
        GitDiffScope::Staged => "staged",
        GitDiffScope::Unstaged => "unstaged",
        GitDiffScope::Untracked => "untracked",
    }
    .to_string();
    Ok(GitDiffResponse {
        patch,
        scope: scope_str,
        path: path.map(str::to_string),
    })
}

pub fn apply_git_file_actions_for_worktree(
    db: &Db,
    worktree_id: &str,
    action: GitFileAction,
    paths: &[String],
) -> AppResult<()> {
    let worktree = require_linked_worktree(db, worktree_id)?;
    apply_git_file_action(&worktree.path, action, paths)
        .map_err(|e: GitError| git_panel_error(e.message, 400))
}

pub fn commit_git_for_worktree(db: &Db, worktree_id: &str, message: &str) -> AppResult<()> {
    let worktree = require_linked_worktree(db, worktree_id)?;
    commit_staged_changes(&worktree.path, message)
        .map_err(|e: GitError| git_panel_error(e.message, 400))
}
