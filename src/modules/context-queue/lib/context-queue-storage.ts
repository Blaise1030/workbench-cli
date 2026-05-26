import { useLocalStorage } from "@vueuse/core";
import { computed, type MaybeRefOrGetter, toValue } from "vue";

export interface ContextQueueState {
  text: string;
}

const STORAGE_PREFIX = "lan-terminal:context-queue:";

export function useContextQueueStorage(worktreeId: MaybeRefOrGetter<string>) {
  const key = computed(() => `${STORAGE_PREFIX}${toValue(worktreeId)}`);
  return useLocalStorage<ContextQueueState>(key, { text: "" });
}
