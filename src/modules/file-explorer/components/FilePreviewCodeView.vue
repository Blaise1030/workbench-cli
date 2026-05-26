<script setup lang="ts">
import { CodeView, type CodeViewItem } from "@pierre/diffs";
import { useMutationObserver } from "@vueuse/core";
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from "vue";
import { useAppColorMode } from "@/shared/hooks/useAppColorMode";
import {
  getPierreWorkerPool,
  PIERRE_DIFF_THEME,
  whenPierreWorkerReady,
} from "@/shared/lib/pierre-diff-worker-pool";

const props = defineProps<{
  filePath: string;
  content: string;
}>();

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

function viewOptions() {
  return {
    theme: PIERRE_DIFF_THEME,
    themeType: themeType.value,
    disableBackground: false,
    disableLineNumbers: false,
    overflow: "scroll" as const,
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
  instance.setItems(items.value);
  viewer.value = instance;
}

async function syncViewer() {
  if (!viewer.value) {
    await mountViewer();
    return;
  }
  viewer.value.setOptions(viewOptions());
  viewer.value.setItems(items.value);
}

onMounted(() => {
  void mountViewer();
});

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
  viewer.value?.cleanUp();
  viewer.value = null;
});
</script>

<template>
  <div ref="rootRef" class="file-preview-code-view min-h-0 flex-1 overflow-auto" />
</template>

<style>
.file-preview-code-view {
  contain: strict;
}
</style>
