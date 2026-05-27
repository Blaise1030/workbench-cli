import type {
  CodeViewItem,
  CodeViewLineSelection,
  SelectedLineRange,
} from "@pierre/diffs";
import { shallowRef, type Ref } from "vue";
import {
  annotationSideFromRange,
  createContextQueueAnnotationElement,
  relativePathForItem,
} from "@/modules/context-queue/lib/create-context-queue-annotation-element";
import type { ContextQueueAnnotationMeta } from "@/modules/context-queue/lib/context-queue-annotation-types";
import type {
  ContextQueueAnnotationsState,
  StoredContextQueueAnnotation,
} from "@/modules/context-queue/lib/context-queue-annotations-state";
import { pierreSelectionText } from "@/modules/code-selection-affix/lib/pierre-line-selection";
import {
  isCrossSideRange,
  normalizedLineSpan,
  singleSideRange,
} from "@/modules/context-queue/lib/format-line-range";
import type { useContextQueue } from "@/modules/context-queue/hooks/use-context-queue";
import { syncPierreAnnotationSlotsForHost } from "@/modules/context-queue/lib/sync-pierre-annotation-slots";
import { toast } from "vue-sonner";

export function usePierreContextQueueAnnotations(opts: {
  items: Ref<readonly CodeViewItem[]>;
  contextQueue: ReturnType<typeof useContextQueue> | null;
  annotationState: ContextQueueAnnotationsState | null;
  onAnnotationsChange: () => void;
}) {
  const annotations = opts.annotationState?.annotations;
  const lastSelection = shallowRef<CodeViewLineSelection | null>(null);

  function findMeta(id: string): ContextQueueAnnotationMeta | undefined {
    return annotations?.value.find((entry) => entry.metadata?.id === id)
      ?.metadata;
  }

  function syncViewer() {
    opts.onAnnotationsChange();
  }

  function addAnnotation(
    item: CodeViewItem,
    range: SelectedLineRange,
    selectionText: string,
  ) {
    if (!annotations) return;
    const scoped = singleSideRange(range);
    if (item.type === "diff" && isCrossSideRange(range)) {
      toast.message("Comment on one side only", {
        description: "Anchored to the line where you finished selecting (like GitHub).",
      });
    }
    const relativePath = relativePathForItem(item);
    const { end } = normalizedLineSpan(scoped);
    const meta: ContextQueueAnnotationMeta = {
      id: crypto.randomUUID(),
      itemId: item.id,
      relativePath,
      range: scoped,
      selection: selectionText,
      note: "",
      includeSnippet: false,
      diff: item.type === "diff",
    };

    const entry: StoredContextQueueAnnotation =
      item.type === "diff"
        ? {
            side: annotationSideFromRange({
              side: scoped.side,
              endSide: scoped.endSide,
            }),
            lineNumber: end,
            metadata: meta,
          }
        : { lineNumber: end, metadata: meta };

    annotations.value = [...annotations.value, entry];
    syncViewer();
  }

  function selectionTextForItem(
    item: CodeViewItem,
    range: SelectedLineRange,
  ): string {
    const scoped = singleSideRange(range);
    const selection: CodeViewLineSelection = { id: item.id, range: scoped };
    return pierreSelectionText(opts.items.value, selection);
  }

  function onGutterUtilityClick(
    range: SelectedLineRange,
    context: { item: CodeViewItem },
  ) {
    if (!opts.contextQueue) return;
    const text = selectionTextForItem(context.item, range);
    addAnnotation(context.item, range, text);
  }

  function mountAnnotationSlots(host: HTMLElement, item: CodeViewItem) {
    syncPierreAnnotationSlotsForHost(host, item, renderAnnotation);
  }

  function onNoteChange(id: string, note: string) {
    const meta = findMeta(id);
    if (!meta) return;
    meta.note = note;
  }

  function onIncludeSnippetChange(id: string, include: boolean) {
    const meta = findMeta(id);
    if (!meta) return;
    meta.includeSnippet = include;
  }

  function onQueue(meta: ContextQueueAnnotationMeta) {
    if (!opts.contextQueue || meta.queued) return;
    opts.contextQueue.appendFromContext({
      relativePath: meta.relativePath,
      lineRange: meta.range,
      diff: meta.diff,
      note: meta.note,
      selection: meta.selection,
      includeSnippet: meta.includeSnippet,
    });
    meta.queued = true;
    syncViewer();
  }

  function onRemove(id: string) {
    if (!annotations) return;
    annotations.value = annotations.value.filter(
      (entry) => entry.metadata?.id !== id,
    );
    syncViewer();
  }

  function renderAnnotation(annotation: StoredContextQueueAnnotation): HTMLElement {
    return createContextQueueAnnotationElement(annotation, {
      onNoteChange,
      onIncludeSnippetChange,
      onQueue,
      onRemove,
    });
  }

  function mergeAnnotations(items: readonly CodeViewItem[]): CodeViewItem[] {
    const list = annotations?.value ?? [];
    return items.map((item) => {
      const itemAnnotations = list.filter(
        (entry) => entry.metadata?.itemId === item.id,
      );
      if (item.type === "diff") {
        return { ...item, annotations: itemAnnotations };
      }
      return { ...item, annotations: itemAnnotations };
    });
  }

  function addFromCurrentSelection(
    items: readonly CodeViewItem[],
  ): boolean {
    const sel = lastSelection.value;
    if (!sel || !opts.contextQueue) return false;
    const item = items.find((entry) => entry.id === sel.id);
    if (!item) return false;
    const text = selectionTextForItem(item, sel.range);
    addAnnotation(item, sel.range, text);
    return true;
  }

  const pierreContextQueueOptions = opts.contextQueue
    ? {
        enableGutterUtility: true,
        enableLineSelection: true,
        lineHoverHighlight: "line" as const,
        renderAnnotation: (
          annotation: StoredContextQueueAnnotation,
          _context: unknown,
        ) => renderAnnotation(annotation),
        onGutterUtilityClick: (
          range: SelectedLineRange,
          context: { item: CodeViewItem },
        ) => onGutterUtilityClick(range, context),
      }
    : {
        enableLineSelection: true,
      };

  const pierreCodeViewOptions = {
    onSelectedLinesChange(selection: CodeViewLineSelection | null) {
      lastSelection.value = selection;
    },
  };

  return {
    annotations,
    pierreContextQueueOptions,
    pierreCodeViewOptions,
    mergeAnnotations,
    mountAnnotationSlots,
    addFromCurrentSelection,
    addAnnotationFromSelection(
      item: CodeViewItem,
      selection: CodeViewLineSelection,
    ) {
      addAnnotation(
        item,
        selection.range,
        selectionTextForItem(item, selection.range),
      );
    },
  };
}
