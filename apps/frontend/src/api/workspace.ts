/** @deprecated Import from `@/modules/*/queries` instead. Re-exported for compatibility. */
export { workspaceKeys } from "@/modules/workspace/queries/keys";
export type { Project, Worktree } from "@/modules/workspace/queries/types";
export {
  projectsQueryOptions,
  useProjectsQuery,
  branchesQueryOptions,
  worktreesQueryOptions,
  worktreeQueryOptions,
  useRegisterProjectMutation,
  usePickProjectFolderMutation,
  useCreateWorktreeMutation,
  useDeleteWorktreeMutation,
} from "@/modules/workspace/queries/projects";
export type {
  GitFileStatusCode,
  GitStatusEntry,
  GitDiffScope,
} from "@/modules/git/queries/types";
export { gitStatusQueryOptions, gitDiffQueryOptions } from "@/modules/git/queries/git";
export type { TerminalTab } from "@/modules/terminal/queries/types";
export {
  terminalsQueryOptions,
  useTerminalsQuery,
  useCreateTerminalMutation,
  useUpdateTerminalMutation,
  useDeleteTerminalMutation,
} from "@/modules/terminal/queries/terminals";
export {
  fileContentQueryOptions,
  fileTreeQueryOptions,
} from "@/modules/file-explorer/queries/files";
