import type { CodeViewLineSelection } from "@pierre/diffs";
import { useEventListener } from "@vueuse/core";
import {
  ref,
  shallowRef,
  type MaybeRefOrGetter,
  toValue,
  watch,
} from "vue";
import type { Rect } from "@/modules/code-selection-affix/lib/context-queue-anchor";
import { pierreSelectionAnchorRect } from "@/modules/code-selection-affix/lib/pierre-line-selection";

export function usePierreLineSelectionAffix(opts: {
  root: MaybeRefOrGetter<HTMLElement | null>;
  itemIds: MaybeRefOrGetter<readonly string[]>;
}) {
  const visible = ref(false);
  const anchor = ref<Rect | null>(null);
  const selection = shallowRef<CodeViewLineSelection | null>(null);

  function syncPosition() {
    const sel = selection.value;
    const el = toValue(opts.root);
    if (!sel || !el) {
      visible.value = false;
      anchor.value = null;
      return;
    }
    const next = pierreSelectionAnchorRect(el, toValue(opts.itemIds), sel);
    if (!next) {
      visible.value = false;
      anchor.value = null;
      return;
    }
    anchor.value = next;
    visible.value = true;
  }

  function scheduleSync() {
    requestAnimationFrame(syncPosition);
  }

  function onSelectedLinesChange(next: CodeViewLineSelection | null) {
    selection.value = next;
    if (!next) {
      visible.value = false;
      anchor.value = null;
      return;
    }
    scheduleSync();
  }

  function hide() {
    visible.value = false;
    anchor.value = null;
    selection.value = null;
  }

  useEventListener(window, "scroll", scheduleSync, { capture: true });
  useEventListener(window, "resize", scheduleSync);
  useEventListener(window.visualViewport ?? window, "scroll", scheduleSync);
  useEventListener(window.visualViewport ?? window, "resize", scheduleSync);

  watch(
    () => toValue(opts.root),
    (el, _prev, onCleanup) => {
      if (!el) return;
      const stop = useEventListener(el, "scroll", scheduleSync, {
        passive: true,
      });
      onCleanup(stop);
    },
  );

  return {
    visible,
    anchor,
    selection,
    hide,
    syncPosition,
    onSelectedLinesChange,
  };
}
