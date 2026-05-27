pub mod actions;
pub mod commit;
pub mod diff;
pub mod exec;
pub mod status;
pub mod worktree_create;
pub mod worktree_list;

pub use actions::{apply_git_file_action, paths_for_action, GitFileAction};
pub use commit::{commit_staged_changes, has_staged_changes};
pub use diff::{get_worktree_diff, list_untracked_file_paths, GitDiffScope};
pub use exec::{is_git_repo, run_git, run_git_with_stdout, GitError, RunGitOptions};
pub use status::{parse_git_status_porcelain, GitFileStatusCode};
pub use worktree_create::{create_worktree, CreateWorktreeInput, CreateWorktreeResult};
pub use worktree_list::{
    branch_exists, get_default_branch, list_branches, list_worktrees, parse_worktree_porcelain,
    worktree_path_exists, GitWorktreeEntry,
};
