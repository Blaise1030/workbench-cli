use super::exec::{run_git, GitError};
use super::status::{parse_git_status_porcelain, GitFileStatusCode};
use crate::types::GitStatusEntry;
use std::collections::HashMap;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum GitFileAction {
    Stage,
    Unstage,
    Discard,
}

impl GitFileAction {
    pub fn parse(s: &str) -> Option<Self> {
        match s {
            "stage" => Some(Self::Stage),
            "unstage" => Some(Self::Unstage),
            "discard" => Some(Self::Discard),
            _ => None,
        }
    }
}

fn status_by_path(entries: &[GitStatusEntry]) -> HashMap<String, &GitStatusEntry> {
    entries.iter().map(|e| (e.path.clone(), e)).collect()
}

fn find_status_entry<'a>(
    path: &str,
    by_path: &'a HashMap<String, &GitStatusEntry>,
) -> Option<&'a GitStatusEntry> {
    if let Some(exact) = by_path.get(path) {
        return Some(exact);
    }
    for (entry_path, entry) in by_path {
        if entry_path.ends_with('/') && path.starts_with(entry_path.as_str()) {
            return Some(entry);
        }
    }
    None
}

pub fn paths_for_action(
    action: GitFileAction,
    paths: &[String],
    entries: &[GitStatusEntry],
) -> Vec<String> {
    let by_path = status_by_path(entries);
    match action {
        GitFileAction::Stage => paths
            .iter()
            .filter(|path| {
                find_status_entry(path, &by_path)
                    .and_then(|e| e.unstaged.as_deref())
                    .is_some()
            })
            .cloned()
            .collect(),
        GitFileAction::Unstage => paths
            .iter()
            .filter(|path| {
                find_status_entry(path, &by_path)
                    .and_then(|e| e.staged.as_deref())
                    .is_some()
            })
            .cloned()
            .collect(),
        GitFileAction::Discard => paths
            .iter()
            .filter(|path| {
                find_status_entry(path, &by_path)
                    .and_then(|e| e.unstaged.as_deref())
                    .is_some()
            })
            .cloned()
            .collect(),
    }
}

pub fn apply_git_file_action(
    worktree_path: &str,
    action: GitFileAction,
    paths: &[String],
) -> Result<(), GitError> {
    if paths.is_empty() {
        return Ok(());
    }

    let raw = run_git(
        worktree_path,
        &["status", "--porcelain"],
        Some(super::exec::RunGitOptions { trim: false }),
    )?;
    let entries = parse_git_status_porcelain(&raw);
    let applicable = paths_for_action(action, paths, &entries);
    if applicable.is_empty() {
        return Ok(());
    }

    let by_path = status_by_path(&entries);

    match action {
        GitFileAction::Stage => {
            let mut args = vec!["add", "--"];
            args.extend(applicable.iter().map(String::as_str));
            run_git(worktree_path, &args, None)?;
        }
        GitFileAction::Unstage => {
            let mut args = vec!["restore", "--staged", "--"];
            args.extend(applicable.iter().map(String::as_str));
            run_git(worktree_path, &args, None)?;
        }
        GitFileAction::Discard => {
            let mut tracked = Vec::new();
            let mut untracked = Vec::new();
            for path in applicable {
                if let Some(entry) = by_path.get(&path) {
                    if entry.unstaged.as_deref() == Some(GitFileStatusCode::Untracked.as_str()) {
                        untracked.push(path);
                    } else {
                        tracked.push(path);
                    }
                }
            }
            if !tracked.is_empty() {
                let mut args = vec!["restore", "--worktree", "--"];
                args.extend(tracked.iter().map(String::as_str));
                run_git(worktree_path, &args, None)?;
            }
            if !untracked.is_empty() {
                let mut args = vec!["clean", "-fd", "--"];
                args.extend(untracked.iter().map(String::as_str));
                run_git(worktree_path, &args, None)?;
            }
        }
    }

    Ok(())
}
