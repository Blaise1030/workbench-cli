use super::exec::{run_git, run_git_with_stdout, GitError, RunGitOptions};
use std::fs;
use std::path::Path;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum GitDiffScope {
    All,
    Staged,
    Unstaged,
    Untracked,
}

impl GitDiffScope {
    pub fn parse(value: Option<&str>) -> Self {
        match value {
            Some("staged") => Self::Staged,
            Some("unstaged") => Self::Unstaged,
            Some("untracked") => Self::Untracked,
            _ => Self::All,
        }
    }
}

/// Untracked file paths (not directories) under the worktree.
pub fn list_untracked_file_paths(worktree_path: &str, path: Option<&str>) -> Result<Vec<String>, GitError> {
    let raw = run_git(
        worktree_path,
        &["ls-files", "--others", "--exclude-standard"],
        Some(RunGitOptions { trim: false }),
    )?;

    let mut paths: Vec<String> = raw
        .lines()
        .filter(|line| !line.is_empty())
        .map(str::to_string)
        .collect();

    if let Some(path) = path {
        paths.retain(|entry_path| entry_path == path || entry_path.starts_with(&format!("{path}/")));
    }

    Ok(paths
        .into_iter()
        .filter(|file_path| {
            fs::metadata(Path::new(worktree_path).join(file_path))
                .map(|m| m.is_file())
                .unwrap_or(false)
        })
        .collect())
}

fn get_untracked_worktree_diff(worktree_path: &str, path: Option<&str>) -> Result<String, GitError> {
    let mut patches = Vec::new();
    let dev_null = if cfg!(windows) { "NUL" } else { "/dev/null" };

    for file_path in list_untracked_file_paths(worktree_path, path)? {
        match run_git_with_stdout(
            worktree_path,
            &["diff", "--no-index", "--", dev_null, &file_path],
            Some(RunGitOptions { trim: false }),
        ) {
            Ok(patch) if !patch.trim().is_empty() => patches.push(patch),
            Ok(_) => {}
            Err(_) => {}
        }
    }

    Ok(patches.join("\n"))
}

fn join_patches(parts: &[String]) -> String {
    parts
        .iter()
        .filter(|part| !part.trim().is_empty())
        .cloned()
        .collect::<Vec<_>>()
        .join("\n")
}

pub fn get_worktree_diff(
    worktree_path: &str,
    scope: GitDiffScope,
    path: Option<&str>,
) -> Result<String, GitError> {
    match scope {
        GitDiffScope::Untracked => return get_untracked_worktree_diff(worktree_path, path),
        GitDiffScope::Unstaged => {
            let mut diff_args = vec!["diff"];
            if let Some(path) = path {
                diff_args.push("--");
                diff_args.push(path);
            }
            let unstaged_patch = run_git_with_stdout(
                worktree_path,
                &diff_args,
                Some(RunGitOptions { trim: false }),
            )?;
            let untracked_patch = get_untracked_worktree_diff(worktree_path, path)?;
            return Ok(join_patches(&[unstaged_patch, untracked_patch]));
        }
        _ => {}
    }

    let mut args: Vec<&str> = match scope {
        GitDiffScope::Staged => vec!["diff", "--cached"],
        GitDiffScope::All => vec!["diff", "HEAD"],
        _ => unreachable!(),
    };

    if let Some(path) = path {
        args.push("--");
        args.push(path);
    }

    run_git_with_stdout(worktree_path, &args, Some(RunGitOptions { trim: false }))
}
