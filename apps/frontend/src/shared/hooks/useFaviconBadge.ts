import { computed, watch } from "vue";
import { useSessionsQuery } from "@/modules/sessions/queries";
import { setFaviconBadge } from "@/shared/lib/sync-favicon";

export function useFaviconBadge() {
  const { data: sessions } = useSessionsQuery();

  const needsAttention = computed(() =>
    sessions.value?.some((s) => s.agentStatus === "needs_attention") ?? false,
  );

  watch(needsAttention, (val) => setFaviconBadge(val), { immediate: true });
}
