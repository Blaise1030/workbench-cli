use super::exec::{run_git, GitError};
use std::path::Path;

#[derive(Debug, Clone)]
pub struct GitWorktreeEntry {
    pub path: String,
    pub head: Option<String>,
    pub branch: Option<String>,
    pub git_dir: Option<String>,
}

pub fn parse_worktree_porcelain(output: &str) -> Vec<GitWorktreeEntry> {
    let mut entries = Vec::new();
    let mut current: Option<GitWorktreeEntry> = None;

    let flush = |current: &mut Option<GitWorktreeEntry>, entries: &mut Vec<GitWorktreeEntry>| {
        if let Some(entry) = current.take() {
            if !entry.path.is_empty() {
                entries.push(entry);
            }
        }
    };

    for line in output.lines() {
        if line.trim().is_empty() {
            flush(&mut current, &mut entries);
            continue;
        }
        if let Some(rest) = line.strip_prefix("worktree ") {
            flush(&mut current, &mut entries);
            current = Some(GitWorktreeEntry {
                path: rest.trim().to_string(),
                head: None,
                branch: None,
                git_dir: None,
            });
        } else if let Some(entry) = current.as_mut() {
            if let Some(rest) = line.strip_prefix("HEAD ") {
                entry.head = Some(rest.trim().to_string());
            } else if let Some(rest) = line.strip_prefix("branch ") {
                let branch = rest.trim().trim_start_matches("refs/heads/").to_string();
                entry.branch = Some(branch);
            } else if let Some(rest) = line.strip_prefix("gitdir ") {
                entry.git_dir = Some(rest.trim().to_string());
            }
        }
    }
    flush(&mut current, &mut entries);
    entries
}

pub fn list_worktrees(repo_path: &str) -> Result<Vec<GitWorktreeEntry>, GitError> {
    let out = run_git(repo_path, &["worktree", "list", "--porcelain"], None)?;
    Ok(parse_worktree_porcelain(&out))
}

pub fn list_branches(repo_path: &str) -> Result<Vec<String>, GitError> {
    let out = run_git(
        repo_path,
        &["branch", "--format=%(refname:short)"],
        None,
    )?;
    Ok(out
        .lines()
        .map(str::trim)
        .filter(|b| !b.is_empty())
        .map(str::to_string)
        .collect())
}

pub fn get_default_branch(repo_path: &str) -> String {
    if let Ok(sym) = run_git(
        repo_path,
        &["symbolic-ref", "refs/remotes/origin/HEAD"],
        None,
    ) {
        if let Some(branch) = sym.strip_prefix("refs/remotes/origin/") {
            if !branch.is_empty() {
                return branch.to_string();
            }
        }
    }

    if let Ok(current) = run_git(repo_path, &["branch", "--show-current"], None) {
        if !current.is_empty() {
            return current;
        }
    }

    list_branches(repo_path)
        .ok()
        .and_then(|branches| branches.into_iter().next())
        .unwrap_or_else(|| "main".to_string())
}

pub fn branch_exists(repo_path: &str, branch: &str) -> Result<bool, GitError> {
    Ok(list_branches(repo_path)?.iter().any(|b| b == branch))
}

pub fn worktree_path_exists(path: &str) -> bool {
    Path::new(path).exists()
}
