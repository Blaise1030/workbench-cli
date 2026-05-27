import { ref, toValue, watch, type MaybeRefOrGetter } from "vue";
import type {
  DiffLineAnnotation,
  LineAnnotation,
} from "@pierre/diffs";
import type { ContextQueueAnnotationMeta } from "@/modules/context-queue/lib/context-queue-annotation-types";

export type StoredContextQueueAnnotation =
  | LineAnnotation<ContextQueueAnnotationMeta>
  | DiffLineAnnotation<ContextQueueAnnotationMeta>;

export type ContextQueueViewBridge = () => boolean;

const LEGACY_ANNOTATIONS_PREFIX = "lan-terminal:context-queue-annotations:";
let legacyAnnotationsStorageCleared = false;

function clearLegacyAnnotationsStorage() {
  if (legacyAnnotationsStorageCleared || typeof localStorage === "undefined") {
    return;
  }
  legacyAnnotationsStorageCleared = true;
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const key = localStorage.key(i);
    if (key?.startsWith(LEGACY_ANNOTATIONS_PREFIX)) localStorage.removeItem(key);
  }
}

export function createContextQueueAnnotationsState(
  worktreeId: MaybeRefOrGetter<string>,
) {
  clearLegacyAnnotationsStorage();

  const annotations = ref<StoredContextQueueAnnotation[]>([]);

  watch(
    () => toValue(worktreeId),
    () => {
      annotations.value = [];
    },
  );

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
