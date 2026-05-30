import type { QueryClient } from "@tanstack/vue-query";
import { workspaceKeys } from "./keys";

/** Refetch file tree and git status for a worktree (e.g. after external FS/git changes). */
export function invalidateWorkspaceFs(
  queryClient: QueryClient,
  worktreeId: string,
) {
  return Promise.all([
    queryClient.invalidateQueries({
      queryKey: workspaceKeys.fileTree(worktreeId),
    }),
    queryClient.invalidateQueries({
      queryKey: workspaceKeys.gitStatus(worktreeId),
    }),
  ]);
}
