export const workspaceKeys = {
  all: ["workspace"] as const,
  projects: () => [...workspaceKeys.all, "projects"] as const,
  branches: (projectId: string) =>
    [...workspaceKeys.all, "branches", projectId] as const,
  worktrees: (projectId: string) =>
    [...workspaceKeys.all, "worktrees", projectId] as const,
  worktree: (worktreeId: string) =>
    [...workspaceKeys.all, "worktree", worktreeId] as const,
  terminals: (worktreeId: string) =>
    [...workspaceKeys.all, "terminals", worktreeId] as const,
  gitStatus: (worktreeId: string) =>
    [...workspaceKeys.all, "git-status", worktreeId] as const,
  gitDiff: (
    worktreeId: string,
    scope: "all" | "staged" | "unstaged",
    path: string | null,
  ) =>
    [...workspaceKeys.all, "git-diff", worktreeId, scope, path] as const,
  fileTree: (worktreeId: string) =>
    [...workspaceKeys.all, "file-tree", worktreeId] as const,
  fileContent: (worktreeId: string, path: string) =>
    [...workspaceKeys.all, "file-content", worktreeId, path] as const,
};
