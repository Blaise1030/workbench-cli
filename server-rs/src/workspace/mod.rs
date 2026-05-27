pub mod drop_assets;
pub mod files;
pub mod git_panel;
pub mod path_guard;
pub mod pick_folder;
pub mod projects;
pub mod terminals;
pub mod worktrees;

pub use drop_assets::{
    get_workbench_image_dir, prune_workbench_image_dir, save_workbench_drop_assets,
    DropAssetUpload, PruneDropAssetsOptions, SaveDropAssetsOptions, DROP_ASSET_MAX_AGE_MS,
    DROP_ASSET_MAX_DIR_BYTES, DROP_ASSET_MAX_FILE_BYTES,
};
pub use files::{
    list_files_for_worktree, read_file_for_worktree, write_file_for_worktree, FilePreview,
    MAX_FILE_PREVIEW_BYTES,
};
pub use git_panel::{
    apply_git_file_actions_for_worktree, commit_git_for_worktree, get_git_diff_for_worktree,
    get_git_status_for_worktree, GitDiffResponse, GitStatusResponse,
};
pub use path_guard::assert_path_within_root;
pub use pick_folder::pick_folder;
pub use projects::{delete_project, get_project, list_projects, register_project};
pub use terminals::{
    clear_terminal_agent_session, create_terminal, delete_terminal, get_terminal,
    get_terminal_with_worktree, list_terminals, update_terminal, update_terminal_agent_session,
    TerminalWithWorktree, UpdateTerminalPatch,
};
pub use worktrees::{
    create_worktree_for_project, delete_worktree, get_worktree, list_worktrees_by_project,
    sync_worktrees_for_project,
};
