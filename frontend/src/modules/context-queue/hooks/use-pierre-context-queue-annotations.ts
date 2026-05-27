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
  resolveCodeViewItem,
} from "@/modules/context-queue/lib/context-queue-annotation-popover";
import type { ContextQueueAnnotationMeta } from "@/modules/context-queue/lib/context-queue-annotation-types";
import type {
  ContextQueueAnnotationsState,
  StoredContextQueueAnnotation,
} from "@/modules/context-queue/lib/context-queue-annotations-state";
import { pierreSelectionText } from "@/modules/context-queue/lib/pierre-selection-text";
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

  function createDraftAnnotation(
    item: CodeViewItem,
    range: SelectedLineRange,
    selectionText: string,
  ): StoredContextQueueAnnotation {
    const scoped = singleSideRange(range);
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
      expanded: true,
    };

    return item.type === "diff"
      ? {
          side: annotationSideFromRange({
            side: scoped.side,
            endSide: scoped.endSide,
          }),
          lineNumber: end,
          metadata: meta,
        }
      : { lineNumber: end, metadata: meta };
  }

  function upsertDraftAnnotation(item: CodeViewItem, range: SelectedLineRange) {
    if (!annotations || !opts.contextQueue) return;
    if (item.type === "diff" && isCrossSideRange(range)) {
      toast.message("Comment on one side only", {
        description: "Anchored to the line where you finished selecting (like GitHub).",
      });
    }
    const scoped = singleSideRange(range);
    const text = selectionTextForItem(item, range);
    const { end } = normalizedLineSpan(scoped);
    const relativePath = relativePathForItem(item);

    const draftIndex = annotations.value.findIndex(
      (entry) =>
        entry.metadata?.itemId === item.id && entry.metadata?.queued !== true,
    );

    if (draftIndex >= 0) {
      const entry = annotations.value[draftIndex]!;
      const meta = entry.metadata!;
      meta.range = scoped;
      meta.selection = text;
      meta.relativePath = relativePath;
      meta.expanded = true;
      entry.lineNumber = end;
      if (item.type === "diff" && "side" in entry) {
        entry.side = annotationSideFromRange({
          side: scoped.side,
          endSide: scoped.endSide,
        });
      }
      annotations.value = [...annotations.value];
      syncViewer();
      return;
    }

    annotations.value = [
      ...annotations.value,
      createDraftAnnotation(item, range, text),
    ];
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

  function itemFromPierreCallback(
    context: CodeViewItem | { item: CodeViewItem } | undefined,
  ): CodeViewItem | null {
    return (
      resolveCodeViewItem(context) ??
      (lastSelection.value
        ? (opts.items.value.find((entry) => entry.id === lastSelection.value?.id) ??
          null)
        : null)
    );
  }

  function onGutterUtilityClick(
    range: SelectedLineRange,
    context?: CodeViewItem | { item: CodeViewItem },
  ) {
    const item = itemFromPierreCallback(context);
    if (!item) return;
    upsertDraftAnnotation(item, range);
  }

  function onLineSelectionEnd(
    range: SelectedLineRange | null,
    context?: CodeViewItem | { item: CodeViewItem },
  ) {
    if (!range) return;
    const item = itemFromPierreCallback(context);
    if (!item) return;
    upsertDraftAnnotation(item, range);
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
    if (annotations) {
      annotations.value = [...annotations.value];
    }
  }

  function onExpand(id: string) {
    const meta = findMeta(id);
    if (!meta) return;
    meta.expanded = true;
    syncViewer();
  }

  function onCollapse(id: string) {
    const meta = findMeta(id);
    if (!meta) return;
    meta.expanded = false;
    syncViewer();
  }

  function onQueue(payload: ContextQueueAnnotationMeta) {
    const meta = findMeta(payload.id);
    if (!meta || !opts.contextQueue || meta.queued) return;
    meta.note = payload.note;
    meta.includeSnippet = payload.includeSnippet;
    opts.contextQueue.appendFromContext({
      relativePath: meta.relativePath,
      lineRange: meta.range,
      diff: meta.diff,
      note: meta.note,
      selection: meta.selection,
      includeSnippet: meta.includeSnippet,
    });
    if (annotations) {
      annotations.value = annotations.value.filter(
        (entry) => entry.metadata?.id !== payload.id,
      );
    }
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
      onExpand,
      onCollapse,
    });
  }

  function mergeAnnotations(items: readonly CodeViewItem[]): CodeViewItem[] {
    const list = annotations?.value ?? [];
    return items.map((item) => {
      const itemAnnotations = list.filter(
        (entry) =>
          entry.metadata?.itemId === item.id && entry.metadata?.queued !== true,
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
    upsertDraftAnnotation(item, sel.range);
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
          context: CodeViewItem | { item: CodeViewItem },
        ) => onGutterUtilityClick(range, context),
        onLineSelectionEnd: (
          range: SelectedLineRange | null,
          context: CodeViewItem | { item: CodeViewItem },
        ) => onLineSelectionEnd(range, context),
      }
    : {
        enableLineSelection: true,
      };

  const pierreCodeViewOptions = {
    onSelectedLinesChange(selection: CodeViewLineSelection | null) {
      if (selection !== null) lastSelection.value = selection;
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
      upsertDraftAnnotation(item, selection.range);
    },
  };
}
