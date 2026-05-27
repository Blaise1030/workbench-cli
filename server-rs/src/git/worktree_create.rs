use super::exec::{run_git, GitError};
use super::worktree_list::branch_exists;
use std::path::{Path, PathBuf};

pub struct CreateWorktreeInput<'a> {
    pub repo_path: &'a str,
    pub branch: &'a str,
    pub base_branch: Option<&'a str>,
    pub path: Option<&'a str>,
    pub is_new_branch: Option<bool>,
}

pub struct CreateWorktreeResult {
    pub path: String,
    pub branch: String,
    pub base_branch: Option<String>,
}

fn default_worktree_path(repo_path: &str, branch: &str) -> PathBuf {
    let repo = Path::new(repo_path);
    let parent = repo.parent().unwrap_or_else(|| Path::new("."));
    let repo_name = repo
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("repo");
    let safe_branch = branch.replace('/', "-");
    parent.join(format!("{repo_name}-{safe_branch}"))
}

pub fn create_worktree(input: &CreateWorktreeInput<'_>) -> Result<CreateWorktreeResult, GitError> {
    let exists = branch_exists(input.repo_path, input.branch)?;
    let wants_new = input.is_new_branch == Some(true)
        || (!exists && input.base_branch.is_some());

    if !exists && !wants_new && input.base_branch.is_none() {
        return Err(GitError::new(
            format!(
                "Branch \"{}\" does not exist. Choose a base branch to create it from.",
                input.branch
            ),
            "",
        ));
    }

    let target_path = input
        .path
        .map(str::trim)
        .filter(|p| !p.is_empty())
        .map(PathBuf::from)
        .unwrap_or_else(|| default_worktree_path(input.repo_path, input.branch));
    let target_path = target_path
        .canonicalize()
        .unwrap_or(target_path)
        .to_string_lossy()
        .into_owned();

    if wants_new {
        let base_branch = input
            .base_branch
            .map(str::trim)
            .filter(|s| !s.is_empty())
            .ok_or_else(|| GitError::new("baseBranch is required when creating a new branch", ""))?;

        if !branch_exists(input.repo_path, base_branch)? {
            return Err(GitError::new(
                format!("Base branch \"{base_branch}\" does not exist"),
                "",
            ));
        }
        if exists {
            return Err(GitError::new(
                format!("Branch \"{}\" already exists", input.branch),
                "",
            ));
        }

        run_git(
            input.repo_path,
            &[
                "worktree",
                "add",
                "-b",
                input.branch,
                &target_path,
                base_branch,
            ],
            None,
        )?;
        return Ok(CreateWorktreeResult {
            path: target_path,
            branch: input.branch.to_string(),
            base_branch: Some(base_branch.to_string()),
        });
    }

    if !exists {
        return Err(GitError::new(
            format!("Branch \"{}\" does not exist", input.branch),
            "",
        ));
    }

    run_git(
        input.repo_path,
        &["worktree", "add", &target_path, input.branch],
        None,
    )?;
    Ok(CreateWorktreeResult {
        path: target_path,
        branch: input.branch.to_string(),
        base_branch: None,
    })
}
