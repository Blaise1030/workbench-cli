import type { CodeViewItem, CodeViewLineSelection } from "@pierre/diffs";
import { useEventListener } from "@vueuse/core";
import {
  computed,
  ref,
  shallowRef,
  type MaybeRefOrGetter,
  toValue,
  watch,
} from "vue";
import type { Rect } from "@/modules/code-selection-affix/lib/context-queue-anchor";
import { usePierreLineSelectionAffix } from "@/modules/code-selection-affix/hooks/use-pierre-line-selection-affix";
import { pierreSelectionText } from "@/modules/code-selection-affix/lib/pierre-line-selection";
import { selectionAnchorRect } from "@/modules/code-selection-affix/lib/selection-end-rect";
import { selectionTextInRoot } from "@/modules/context-queue/lib/resolve-code-context";

type AffixMode = "pierre" | "native" | null;

export function useCodeSelectionAffix(opts: {
  root: MaybeRefOrGetter<HTMLElement | null>;
  itemIds: MaybeRefOrGetter<readonly string[]>;
  items: MaybeRefOrGetter<readonly CodeViewItem[]>;
  resolvePath?: (
    root: HTMLElement,
    itemIds: readonly string[],
    selectionText: string,
  ) => string | undefined;
}) {
  const mode = ref<AffixMode>(null);
  const pierre = usePierreLineSelectionAffix({
    root: opts.root,
    itemIds: opts.itemIds,
  });

  const nativeAnchor = ref<Rect | null>(null);
  const nativeActive = ref(false);
  const pierreSelection = shallowRef<CodeViewLineSelection | null>(null);

  const visible = computed(() => pierre.visible.value || nativeActive.value);

  const anchor = computed<Rect | null>(() => {
    if (mode.value === "pierre" || pierre.visible.value) {
      return pierre.anchor.value;
    }
    if (nativeActive.value) return nativeAnchor.value;
    return null;
  });

  function hide() {
    mode.value = null;
    nativeActive.value = false;
    nativeAnchor.value = null;
    pierreSelection.value = null;
    pierre.hide();
  }

  function syncNativeAffix() {
    const el = toValue(opts.root);
    const text = selectionTextInRoot(el).trim();
    if (!text) {
      if (mode.value === "native") hide();
      return;
    }
    const next = selectionAnchorRect(el);
    if (!next) {
      if (mode.value === "native") hide();
      return;
    }
    pierre.hide();
    mode.value = "native";
    pierreSelection.value = null;
    nativeAnchor.value = next;
    nativeActive.value = true;
  }

  function scheduleNativeSync() {
    requestAnimationFrame(syncNativeAffix);
  }

  function onSelectedLinesChange(selection: CodeViewLineSelection | null) {
    if (selection) {
      mode.value = "pierre";
      nativeActive.value = false;
      nativeAnchor.value = null;
      pierreSelection.value = selection;
      pierre.onSelectedLinesChange(selection);
      return;
    }
    if (mode.value === "pierre") hide();
  }

  useEventListener(document, "selectionchange", scheduleNativeSync);

  watch(
    () => toValue(opts.root),
    (el, _prev, onCleanup) => {
      if (!el) return;
      const stopPointer = useEventListener(el, "pointerup", scheduleNativeSync);
      const stopScroll = useEventListener(
        el,
        "scroll",
        () => {
          if (mode.value === "native") scheduleNativeSync();
          else pierre.syncPosition();
        },
        { passive: true },
      );
      onCleanup(() => {
        stopPointer();
        stopScroll();
      });
    },
    { immediate: true },
  );

  useEventListener(
    window,
    "scroll",
    () => {
      if (mode.value === "native") scheduleNativeSync();
      else pierre.syncPosition();
    },
    { capture: true },
  );
  useEventListener(window, "resize", () => {
    if (mode.value === "native") scheduleNativeSync();
    else pierre.syncPosition();
  });

  const pierreSelectionOptions = {
    enableLineSelection: true as const,
    onSelectedLinesChange,
  };

  function getAppendPayload(): {
    relativePath?: string;
    selection: string;
  } {
    const sel = pierreSelection.value;
    if (mode.value === "pierre" && sel) {
      return {
        relativePath: sel.id,
        selection: pierreSelectionText(toValue(opts.items), sel),
      };
    }
    const root = toValue(opts.root);
    const text = selectionTextInRoot(root).trim();
    const relativePath = root
      ? opts.resolvePath?.(root, toValue(opts.itemIds), text)
      : undefined;
    return { relativePath, selection: text };
  }

  return {
    visible,
    anchor,
    hide,
    pierreSelectionOptions,
    getAppendPayload,
  };
}
