import {
  queryOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/vue-query";
import { computed, type MaybeRefOrGetter, toValue } from "vue";
import { apiClient } from "@/lib/api-client";
import { ensureOk } from "@/lib/api-error";
import type { GitFileAction } from "@/modules/git/lib/git-file-actions";
import { workspaceKeys } from "@/modules/workspace/queries/keys";
import { invalidateWorkspaceFs } from "@/modules/workspace/queries/invalidate-workspace-fs";
import type { GitDiffScope, GitStatusEntry } from "./types";

/** Poll git status while a subscriber is mounted (Git panel, file explorer tree). */
export const GIT_STATUS_REFETCH_INTERVAL_MS = 5_000;

export function gitStatusQueryOptions(worktreeId: MaybeRefOrGetter<string>) {
  return queryOptions({
    queryKey: computed(() => workspaceKeys.gitStatus(toValue(worktreeId))),
    queryFn: async () => {
      const id = toValue(worktreeId);
      const res = await apiClient.worktrees[":id"].git.status.$get({
        param: { id },
      });
      return ensureOk<{ branch: string | null; files: GitStatusEntry[] }>(res);
    },
    enabled: computed(() => Boolean(toValue(worktreeId))),
    staleTime: 0,
    refetchInterval: GIT_STATUS_REFETCH_INTERVAL_MS,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: "always",
  });
}

export function gitDiffQueryOptions(
  worktreeId: MaybeRefOrGetter<string>,
  scope: MaybeRefOrGetter<GitDiffScope>,
  path: MaybeRefOrGetter<string | null>,
) {
  return queryOptions({
    queryKey: computed(() =>
      workspaceKeys.gitDiff(
        toValue(worktreeId),
        toValue(scope),
        toValue(path),
      ),
    ),
    queryFn: async () => {
      const id = toValue(worktreeId);
      const res = await apiClient.worktrees[":id"].git.diff.$get({
        param: { id },
        query: {
          scope: toValue(scope),
          ...(toValue(path) ? { path: toValue(path)! } : {}),
        },
      });
      return ensureOk<{ patch: string; scope: GitDiffScope; path: string | null }>(
        res,
      );
    },
    enabled: computed(() => Boolean(toValue(worktreeId))),
    staleTime: 0,
    refetchInterval: GIT_STATUS_REFETCH_INTERVAL_MS,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: "always",
  });
}

function invalidateGitQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  worktreeId: string,
) {
  void invalidateWorkspaceFs(queryClient, worktreeId);
  queryClient.invalidateQueries({
    queryKey: [...workspaceKeys.all, "git-diff", worktreeId],
  });
}

export function useGitFileActionsMutation(worktreeId: MaybeRefOrGetter<string>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      action,
      paths,
    }: {
      action: GitFileAction;
      paths: string[];
    }) => {
      const id = toValue(worktreeId);
      const res = await apiClient.worktrees[":id"].git.actions.$post({
        param: { id },
        json: { action, paths },
      });
      return ensureOk<{ ok: true }>(res);
    },
    onSuccess: () => {
      invalidateGitQueries(queryClient, toValue(worktreeId));
    },
  });
}

export function useGitCommitMutation(worktreeId: MaybeRefOrGetter<string>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ message }: { message: string }) => {
      const id = toValue(worktreeId);
      const res = await apiClient.worktrees[":id"].git.commit.$post({
        param: { id },
        json: { message },
      });
      return ensureOk<{ ok: true }>(res);
    },
    onSuccess: () => {
      invalidateGitQueries(queryClient, toValue(worktreeId));
    },
  });
}
