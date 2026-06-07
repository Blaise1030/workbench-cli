import { computed } from "vue";
import { useLocalStorage } from "@vueuse/core";
import { useQuery } from "@tanstack/vue-query";
import {
  dismissWhatsNewId,
  latestUndismissedWhatsNew,
} from "@/modules/workspace/lib/whats-new";
import { whatsNewQueryOptions } from "@/modules/workspace/queries/whats-new";

const DISMISSED_KEY = "workbench:whats-new-dismissed";

export function useWhatsNew() {
  const { data: entries } = useQuery(whatsNewQueryOptions());
  const dismissedIds = useLocalStorage<string[]>(DISMISSED_KEY, []);

  const latestEntry = computed(() =>
    latestUndismissedWhatsNew(entries.value ?? [], dismissedIds.value ?? []),
  );

  function dismiss(id: string) {
    dismissWhatsNewId(id);
    dismissedIds.value = [...(dismissedIds.value ?? []), id];
  }

  return { entries, latestEntry, dismissedIds, dismiss };
}
