use std::process::Command;

#[derive(Debug, thiserror::Error)]
#[error("{message}")]
pub struct GitError {
    pub message: String,
    pub stderr: String,
}

impl GitError {
    pub fn new(message: impl Into<String>, stderr: impl Into<String>) -> Self {
        Self {
            message: message.into(),
            stderr: stderr.into(),
        }
    }
}

pub struct RunGitOptions {
    pub trim: bool,
}

impl Default for RunGitOptions {
    fn default() -> Self {
        Self { trim: true }
    }
}

pub fn run_git(repo_path: &str, args: &[&str], options: Option<RunGitOptions>) -> Result<String, GitError> {
    let opts = options.unwrap_or_default();
    let output = Command::new("git")
        .arg("-C")
        .arg(repo_path)
        .args(args)
        .output()
        .map_err(|e| GitError::new(e.to_string(), ""))?;

    if output.status.success() {
        let out = String::from_utf8_lossy(&output.stdout).into_owned();
        return Ok(if opts.trim { out.trim().to_string() } else { out });
    }

    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
    Err(GitError::new(
        if stderr.is_empty() {
            "git command failed".to_string()
        } else {
            stderr.clone()
        },
        stderr,
    ))
}

pub fn run_git_with_stdout(
    repo_path: &str,
    args: &[&str],
    options: Option<RunGitOptions>,
) -> Result<String, GitError> {
    let opts = options.unwrap_or_default();
    let output = Command::new("git")
        .arg("-C")
        .arg(repo_path)
        .args(args)
        .output()
        .map_err(|e| GitError::new(e.to_string(), ""))?;

    if output.status.success() {
        let out = String::from_utf8_lossy(&output.stdout).into_owned();
        return Ok(if opts.trim { out.trim().to_string() } else { out });
    }

    let stdout = String::from_utf8_lossy(&output.stdout).into_owned();
    if output.status.code() == Some(1) && !stdout.is_empty() {
        return Ok(if opts.trim {
            stdout.trim().to_string()
        } else {
            stdout
        });
    }

    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
    Err(GitError::new(
        if stderr.is_empty() {
            "git command failed".to_string()
        } else {
            stderr.clone()
        },
        stderr,
    ))
}

pub fn is_git_repo(repo_path: &str) -> bool {
    run_git(repo_path, &["rev-parse", "--git-dir"], None).is_ok()
}
