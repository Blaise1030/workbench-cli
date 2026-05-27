<script setup lang="ts">
import { CodeView, type CodeViewItem } from "@pierre/diffs";
import { useMutationObserver } from "@vueuse/core";
import {
  computed,
  inject,
  onBeforeUnmount,
  onMounted,
  ref,
  shallowRef,
  watch,
} from "vue";
import { useAppColorMode } from "@/shared/hooks/useAppColorMode";
import {
  getPierreWorkerPool,
  PIERRE_DIFF_THEME,
  whenPierreWorkerReady,
} from "@/shared/lib/pierre-diff-worker-pool";
import contextQueueAnnotationStyles from "@/modules/context-queue/lib/context-queue-annotations.css?inline";
import {
  contextQueueAnnotationsKey,
  contextQueueKey,
} from "@/modules/context-queue/lib/context-queue-keys";
import { usePierreContextQueueAnnotations } from "@/modules/context-queue/hooks/use-pierre-context-queue-annotations";

const props = defineProps<{
  filePath: string;
  content: string;
}>();

const contextQueue = inject(contextQueueKey, null);
const annotationState = inject(contextQueueAnnotationsKey, null);
const rootRef = ref<HTMLElement | null>(null);
const viewer = shallowRef<CodeView | null>(null);
const { colorMode } = useAppColorMode();

const themeType = computed(() =>
  colorMode.value === "dark" ? ("dark" as const) : ("light" as const),
);

const items = computed<CodeViewItem[]>(() => [
  {
    id: props.filePath,
    type: "file",
    file: {
      name: props.filePath.split("/").pop() ?? props.filePath,
      contents: props.content,
      cacheKey: `${props.filePath}:${props.content.length}`,
    },
  },
]);

const {
  pierreContextQueueOptions,
  pierreCodeViewOptions,
  mergeAnnotations,
  mountAnnotationSlots,
  addFromCurrentSelection,
} = usePierreContextQueueAnnotations({
  items,
  contextQueue,
  annotationState,
  onAnnotationsChange: () => {
    void syncViewer();
  },
});

function viewOptions() {
  return {
    theme: PIERRE_DIFF_THEME,
    themeType: themeType.value,
    disableBackground: false,
    disableLineNumbers: false,
    overflow: "scroll" as const,
    unsafeCSS: contextQueueAnnotationStyles,
    ...pierreContextQueueOptions,
    ...pierreCodeViewOptions,
    onPostRender: (
      host: HTMLElement,
      _instance: unknown,
      context: { type: string; item: CodeViewItem },
    ) => {
      const merged = mergeAnnotations([context.item])[0];
      if (merged?.annotations?.length) {
        mountAnnotationSlots(host, merged);
      }
    },
  };
}

async function mountViewer() {
  const root = rootRef.value;
  if (!root || viewer.value) return;

  await whenPierreWorkerReady();

  const instance = new CodeView(
    {
      ...viewOptions(),
      disableFileHeader: true,
      stickyHeaders: false,
      layout: { paddingTop: 8, paddingBottom: 8, gap: 0 },
    },
    getPierreWorkerPool(),
  );
  instance.setup(root);
  instance.setItems(mergeAnnotations(items.value));
  viewer.value = instance;
}

function scheduleMountAnnotationSlots() {
  requestAnimationFrame(() => {
    const root = rootRef.value;
    if (!root) return;
    const host = root.querySelector("diffs-container");
    const item = mergeAnnotations(items.value)[0];
    if (host && item?.annotations?.length) {
      mountAnnotationSlots(host as HTMLElement, item);
    }
  });
}

async function syncViewer() {
  if (!viewer.value) {
    await mountViewer();
    return;
  }
  viewer.value.setOptions(viewOptions());
  viewer.value.setItems(mergeAnnotations(items.value));
  scheduleMountAnnotationSlots();
}

onMounted(() => {
  annotationState?.setExplorerBridge(() => addFromCurrentSelection(items.value));
  void mountViewer();
});

watch(
  () => props.filePath,
  () => {
    void syncViewer();
  },
);

watch(items, () => {
  void syncViewer();
}, { deep: true });
watch(themeType, () => {
  void syncViewer();
});

useMutationObserver(
  rootRef,
  () => {
    if (!viewer.value && rootRef.value) void mountViewer();
  },
  { childList: true },
);

onBeforeUnmount(() => {
  annotationState?.setExplorerBridge(null);
  viewer.value?.cleanUp();
  viewer.value = null;
});
</script>

<template>
  <div class="relative flex min-h-0 flex-1 flex-col">
    <div
      ref="rootRef"
      class="file-preview-code-view min-h-0 flex-1 overflow-auto"
    />
  </div>
</template>

<style>
@import "tailwindcss";
@source "../../context-queue/lib/context-queue-annotations.css";

.file-preview-code-view {
  contain: strict;
}
</style>
