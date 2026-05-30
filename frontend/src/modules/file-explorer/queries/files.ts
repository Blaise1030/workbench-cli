import { queryOptions } from "@tanstack/vue-query";
import { computed, type MaybeRefOrGetter, toValue } from "vue";
import { apiClient } from "@/lib/api-client";
import { ensureOk } from "@/lib/api-error";
import { workspaceKeys } from "@/modules/workspace/queries/keys";

export function fileContentQueryOptions(
  worktreeId: MaybeRefOrGetter<string>,
  path: MaybeRefOrGetter<string | null>,
) {
  return queryOptions({
    queryKey: computed(() =>
      workspaceKeys.fileContent(toValue(worktreeId), toValue(path) ?? ""),
    ),
    queryFn: async () => {
      const id = toValue(worktreeId);
      const filePath = toValue(path);
      if (!filePath) throw new Error("No file selected");
      const res = await apiClient.worktrees[":id"].files.content.$get({
        param: { id },
        query: { path: filePath },
      });
      return ensureOk<{ path: string; content: string; truncated: boolean }>(res);
    },
    enabled: computed(() => Boolean(toValue(worktreeId) && toValue(path))),
    staleTime: 30_000,
  });
}

export function fileTreeQueryOptions(worktreeId: MaybeRefOrGetter<string>) {
  return queryOptions({
    queryKey: computed(() => workspaceKeys.fileTree(toValue(worktreeId))),
    queryFn: async () => {
      const id = toValue(worktreeId);
      const res = await apiClient.worktrees[":id"].files.$get({
        param: { id },
      });
      const data = await ensureOk<{ paths: string[] }>(res);
      return data.paths;
    },
    enabled: computed(() => Boolean(toValue(worktreeId))),
    staleTime: Infinity,
    refetchOnWindowFocus: "always",
  });
}
