import { ref, watch, type Ref } from "vue";
import { useDocumentVisibility } from "@vueuse/core";
import { shouldAckAttention } from "@/modules/sessions/clear-attention";
import {
  useAckSessionMutation,
  useSessionsQuery,
} from "@/modules/sessions/queries";

/**
 * Clears a terminal's needs_attention status to idle once it becomes the
 * active tab while the page is visible. Re-arms after the terminal leaves
 * needs_attention, and also fires when the window regains focus while a
 * needs_attention terminal is already active (visibility is a watch source).
 */
export function useClearAttentionOnVisit(activeTerminalId: Ref<string | null>) {
  const { data: sessions } = useSessionsQuery();
  const ack = useAckSessionMutation();
  const visibility = useDocumentVisibility();
  const lastAckedId = ref<string | null>(null);

  function statusFor(id: string | null): string | undefined {
    if (!id) return undefined;
    return sessions.value?.find((s) => s.id === id)?.agentStatus;
  }

  watch(
    [
      activeTerminalId,
      () => statusFor(activeTerminalId.value),
      () => visibility.value,
    ],
    ([id, status, vis]) => {
      // Re-arm once the previously acked terminal is no longer demanding
      // attention, so a future needs_attention episode fires again.
      if (lastAckedId.value && statusFor(lastAckedId.value) !== "needs_attention") {
        lastAckedId.value = null;
      }
      const visible = vis === "visible";
      if (
        shouldAckAttention({
          activeTerminalId: id,
          status,
          visible,
          lastAckedId: lastAckedId.value,
        })
      ) {
        lastAckedId.value = id;
        ack.mutate(id as string);
      }
    },
    { immediate: true },
  );
}
