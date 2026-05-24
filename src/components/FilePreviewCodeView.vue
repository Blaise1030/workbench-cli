<script setup lang="ts">
import { CodeView, type CodeViewItem } from "@pierre/diffs";
import { useMutationObserver } from "@vueuse/core";
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from "vue";
import { useAppColorMode } from "@/composables/useAppColorMode";

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
    theme: { dark: "pierre-dark", light: "pierre-light" },
    themeType: themeType.value,
    disableBackground: false,
    disableLineNumbers: false,
    overflow: "scroll" as const,
  };
}

function mountViewer() {
  const root = rootRef.value;
  if (!root || viewer.value) return;

  const instance = new CodeView({
    ...viewOptions(),
    stickyHeaders: false,
    layout: { paddingTop: 8, paddingBottom: 8, gap: 0 },
  });
  instance.setup(root);
  instance.setItems(items.value);
  viewer.value = instance;
}

function syncViewer() {
  if (!viewer.value) {
    mountViewer();
    return;
  }
  viewer.value.setOptions(viewOptions());
  viewer.value.setItems(items.value);
}

onMounted(() => mountViewer());

watch(items, () => syncViewer(), { deep: true });
watch(themeType, () => syncViewer());

useMutationObserver(
  rootRef,
  () => {
    if (!viewer.value && rootRef.value) mountViewer();
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
