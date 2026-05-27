import type { MaybeRefOrGetter } from "vue";
import type {
  DiffLineAnnotation,
  LineAnnotation,
} from "@pierre/diffs";
import type { ContextQueueAnnotationMeta } from "@/modules/context-queue/lib/context-queue-annotation-types";
import { useContextQueueAnnotationsStorage } from "@/modules/context-queue/lib/context-queue-annotations-storage";

export type StoredContextQueueAnnotation =
  | LineAnnotation<ContextQueueAnnotationMeta>
  | DiffLineAnnotation<ContextQueueAnnotationMeta>;

export type ContextQueueViewBridge = () => boolean;

export function createContextQueueAnnotationsState(
  worktreeId: MaybeRefOrGetter<string>,
) {
  const annotations = useContextQueueAnnotationsStorage(worktreeId);
  let gitBridge: ContextQueueViewBridge | null = null;
  let explorerBridge: ContextQueueViewBridge | null = null;

  return {
    annotations,
    setGitBridge(bridge: ContextQueueViewBridge | null) {
      gitBridge = bridge;
    },
    setExplorerBridge(bridge: ContextQueueViewBridge | null) {
      explorerBridge = bridge;
    },
    invokeGitBridge(): boolean {
      return gitBridge?.() ?? false;
    },
    invokeExplorerBridge(): boolean {
      return explorerBridge?.() ?? false;
    },
  };
}

export type ContextQueueAnnotationsState = ReturnType<
  typeof createContextQueueAnnotationsState
>;
