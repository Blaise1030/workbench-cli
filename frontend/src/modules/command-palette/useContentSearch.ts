import { computed, ref, watch, type Ref } from "vue";
import { useDebounceFn } from "@vueuse/core";
import { apiClient } from "@/lib/api-client";
import { ensureOk } from "@/lib/api-error";

export interface ContentMatch {
  file: string;
  line: number;
  text: string;
}

export function useContentSearch(
  worktreeId: Ref<string | undefined>,
  query: Ref<string>,
) {
  const results = ref<ContentMatch[]>([]);
  const isLoading = ref(false);

  const doSearch = useDebounceFn(async (id: string, q: string) => {
    if (!q.trim()) {
      results.value = [];
      return;
    }
    isLoading.value = true;
    try {
      const res = await apiClient.worktrees[":id"].files["content-search"].$get({
        param: { id },
        query: { q, limit: "50" },
      });
      const data = await ensureOk<{ matches: ContentMatch[] }>(res);
      results.value = data.matches;
    } catch {
      results.value = [];
    } finally {
      isLoading.value = false;
    }
  }, 300);

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

  const resultCount = computed(() => results.value.length);

  return { results, isLoading, resultCount };
}
