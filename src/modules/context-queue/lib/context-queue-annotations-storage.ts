import { useLocalStorage } from "@vueuse/core";
import { computed, type MaybeRefOrGetter, toValue } from "vue";
import type { StoredContextQueueAnnotation } from "@/modules/context-queue/lib/context-queue-annotations-state";

const STORAGE_PREFIX = "lan-terminal:context-queue-annotations:";

export function useContextQueueAnnotationsStorage(
  worktreeId: MaybeRefOrGetter<string>,
) {
  const key = computed(() => `${STORAGE_PREFIX}${toValue(worktreeId)}`);
  return useLocalStorage<StoredContextQueueAnnotation[]>(key, [], {
    mergeDefaults: false,
  });
}
