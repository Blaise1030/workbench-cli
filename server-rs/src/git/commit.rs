use super::exec::{run_git, GitError, RunGitOptions};
use super::status::parse_git_status_porcelain;

pub fn has_staged_changes(worktree_path: &str) -> Result<bool, GitError> {
    let raw = run_git(
        worktree_path,
        &["status", "--porcelain"],
        Some(RunGitOptions { trim: false }),
    )?;
    let entries = parse_git_status_porcelain(&raw);
    Ok(entries.iter().any(|entry| entry.staged.is_some()))
}

pub fn commit_staged_changes(worktree_path: &str, message: &str) -> Result<(), GitError> {
    let trimmed = message.trim();
    if trimmed.is_empty() {
        return Err(GitError::new("Commit message is required", ""));
    }
    if !has_staged_changes(worktree_path)? {
        return Err(GitError::new("Nothing staged to commit", ""));
    }
    run_git(worktree_path, &["commit", "-m", trimmed], None)?;
    Ok(())
}
