use crate::types::GitStatusEntry;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum GitFileStatusCode {
    Added,
    Modified,
    Deleted,
    Renamed,
    Copied,
    Untracked,
    Unmerged,
    Ignored,
    Unknown,
}

impl GitFileStatusCode {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Added => "added",
            Self::Modified => "modified",
            Self::Deleted => "deleted",
            Self::Renamed => "renamed",
            Self::Copied => "copied",
            Self::Untracked => "untracked",
            Self::Unmerged => "unmerged",
            Self::Ignored => "ignored",
            Self::Unknown => "unknown",
        }
    }
}

fn map_status_char(ch: char) -> Option<GitFileStatusCode> {
    match ch {
        ' ' => None,
        '?' => Some(GitFileStatusCode::Untracked),
        '!' => Some(GitFileStatusCode::Ignored),
        'A' => Some(GitFileStatusCode::Added),
        'M' => Some(GitFileStatusCode::Modified),
        'D' => Some(GitFileStatusCode::Deleted),
        'R' => Some(GitFileStatusCode::Renamed),
        'C' => Some(GitFileStatusCode::Copied),
        'U' => Some(GitFileStatusCode::Unmerged),
        _ => Some(GitFileStatusCode::Unknown),
    }
}

fn code_to_option_str(code: Option<GitFileStatusCode>) -> Option<String> {
    code.map(|c| c.as_str().to_string())
}

/// Parse `git status --porcelain` output into structured entries.
pub fn parse_git_status_porcelain(output: &str) -> Vec<GitStatusEntry> {
    let mut entries = Vec::new();

    for line in output.lines() {
        if line.trim().is_empty() {
            continue;
        }

        let chars: Vec<char> = line.chars().collect();
        let index_status = chars.first().copied().unwrap_or(' ');
        let worktree_status = chars.get(1).copied().unwrap_or(' ');
        let mut path_part = if line.len() >= 3 {
            line[3..].to_string()
        } else {
            String::new()
        };

        let mut previous_path: Option<String> = None;
        const RENAME_ARROW: &str = " -> ";
        if path_part.contains(RENAME_ARROW) {
            if let Some((from, to)) = path_part.split_once(RENAME_ARROW) {
                previous_path = Some(from.trim().to_string());
                path_part = to.trim().to_string();
            }
        }

        let path = path_part.trim().to_string();
        if path.is_empty() {
            continue;
        }

        let staged = map_status_char(index_status);
        let unstaged = map_status_char(worktree_status);
        let status = staged.or(unstaged);
        if status.is_none() {
            continue;
        }

        entries.push(GitStatusEntry {
            path,
            previous_path,
            staged: code_to_option_str(staged),
            unstaged: code_to_option_str(unstaged),
        });
    }

    entries
}
