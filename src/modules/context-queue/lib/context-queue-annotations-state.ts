import { ref } from "vue";
import type {
  DiffLineAnnotation,
  LineAnnotation,
} from "@pierre/diffs";
import type { ContextQueueAnnotationMeta } from "@/modules/context-queue/lib/context-queue-annotation-types";

export type StoredContextQueueAnnotation =
  | LineAnnotation<ContextQueueAnnotationMeta>
  | DiffLineAnnotation<ContextQueueAnnotationMeta>;

export type ContextQueueViewBridge = () => boolean;

export function createContextQueueAnnotationsState() {
  const annotations = ref<StoredContextQueueAnnotation[]>([]);
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
