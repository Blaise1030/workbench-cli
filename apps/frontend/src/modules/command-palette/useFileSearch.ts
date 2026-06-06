import { ref, watch, type Ref } from "vue";
import { useDebounceFn } from "@vueuse/core";
import { apiClient } from "@/lib/api-client";
import { ensureOk } from "@/lib/api-error";

export function useFileSearch(
  worktreeId: Ref<string | undefined>,
  query: Ref<string>,
) {
  const results = ref<string[]>([]);
  const isLoading = ref(false);

  const doSearch = useDebounceFn(async (id: string, q: string) => {
    if (!q.trim()) {
      results.value = [];
      return;
    }
    isLoading.value = true;
    try {
      const res = await apiClient.worktrees[":id"].files.search.$get({
        param: { id },
        query: { q, limit: "50" },
      });
      const data = await ensureOk<{ paths: string[] }>(res);
      results.value = data.paths;
    } catch {
      results.value = [];
    } finally {
      isLoading.value = false;
    }
  }, 150);

  watch(
    [worktreeId, query],
    ([id, q]) => {
      if (!id) {
        results.value = [];
        return;
      }
      void doSearch(id, q);
    },
  );

  return { results, isLoading };
}
