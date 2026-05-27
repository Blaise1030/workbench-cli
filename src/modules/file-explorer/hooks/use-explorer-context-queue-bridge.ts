import { onBeforeUnmount, onMounted, type MaybeRefOrGetter, toValue } from "vue";
import type { useContextQueue } from "@/modules/context-queue/hooks/use-context-queue";
import type { ContextQueueAnnotationsState } from "@/modules/context-queue/lib/context-queue-annotations-state";
import { appendExplorerCodeMirrorToQueue } from "@/modules/context-queue/lib/codemirror-selection-context";

export function useExplorerContextQueueBridge(opts: {
  annotationState: ContextQueueAnnotationsState | null;
  contextQueue: ReturnType<typeof useContextQueue> | null;
  relativePath: MaybeRefOrGetter<string | null>;
  worktreePath: MaybeRefOrGetter<string | undefined>;
  fileQuery: MaybeRefOrGetter<string | undefined>;
}) {
  function appendFromEditor(): boolean {
    const queue = opts.contextQueue;
    if (!queue) return false;
    return appendExplorerCodeMirrorToQueue(queue, {
      relativePath: toValue(opts.relativePath),
      worktreePath: toValue(opts.worktreePath),
      fileQueryEncoded: toValue(opts.fileQuery),
    });
  }

  onMounted(() => {
    opts.annotationState?.setExplorerBridge(() => appendFromEditor());
  });

  onBeforeUnmount(() => {
    opts.annotationState?.setExplorerBridge(null);
  });
}
