<script setup lang="ts">
import { nextTick, ref, watch, computed } from "vue";
import {
  XIcon,
  SaveIcon,
  LoaderIcon,
  PanelRightCloseIcon,
  PanelRightOpenIcon,
} from "@lucide/vue";
import { cn } from "@/lib/utils";
import { basename } from "@/modules/file-explorer/lib/file-tabs";
import FileTabIcon from "@/modules/file-explorer/components/FileTabIcon.vue";
import { Button } from "@/components/ui/button";

const props = defineProps<{
  tabs: string[];
  activePath: string | null;
  dirtyPaths?: Set<string>;
  isSaving?: boolean;
  treeCollapsed?: boolean;
}>();

const tabListEl = ref<HTMLElement | null>(null);

watch(
  () => props.activePath,
  async (activePath) => {
    if (!activePath) return;
    await nextTick();
    const el = tabListEl.value?.querySelector<HTMLElement>(
      `[data-file-tab-path="${CSS.escape(activePath)}"]`,
    );
    el?.scrollIntoView({ block: "nearest", inline: "nearest" });
  },
  { flush: "post" },
);

const emit = defineEmits<{
  select: [relativePath: string];
  close: [relativePath: string];
  save: [];
  toggleTree: [];
}>();

const canSave = computed(
  () =>
    props.activePath != null &&
    (props.dirtyPaths?.has(props.activePath) ?? false),
);

function tabClass(relativePath: string) {
  const isActive = relativePath === props.activePath;
  return cn(
    "group inline-flex h-7 max-w-[11rem] shrink-0 items-center gap-1.5 rounded-md px-2 text-[0.8125rem] leading-none transition-colors",
    isActive
      ? "bg-background text-foreground shadow-sm ring-1 ring-border/80"
      : "bg-muted/40 opacity-50 text-muted-foreground hover:bg-muted/70 hover:text-foreground",
  );
}

function closeClass(relativePath: string) {
  const isActive = relativePath === props.activePath;
  return cn(
    "ml-0.5 shrink-0 rounded-sm p-0.5 opacity-0 transition-opacity hover:bg-foreground/10",
    isActive ? "opacity-60" : "group-hover:opacity-60",
  );
}
</script>

<template>
  <div
    v-if="tabs.length > 0"
    class="flex min-h-9 shrink-0 items-center gap-1 px-2 py-1"
    role="tablist"
    aria-label="Open files"
  >
    <div
      ref="tabListEl"
      class="flex min-w-0 flex-1 p-0.5 pe-0 items-center gap-1 relative overflow-x-auto"
    >
      <button
        v-for="relativePath in tabs"
        :key="relativePath"
        type="button"
        role="tab"
        :class="tabClass(relativePath)"
        :data-file-tab-path="relativePath"
        :aria-selected="relativePath === activePath"
        :aria-current="relativePath === activePath ? 'page' : undefined"
        :title="relativePath"
        @click="emit('select', relativePath)"
      >
        <FileTabIcon :relative-path="relativePath" />
        <span class="relative min-w-0 truncate">
          {{ basename(relativePath) }}
          <span
            v-if="dirtyPaths?.has(relativePath)"
            class="ml-1 inline-block size-1.5 rounded-full bg-current opacity-60"
            aria-label="unsaved changes"
          />
        </span>
        <span
          role="button"
          :class="closeClass(relativePath)"
          :aria-label="`Close ${basename(relativePath)}`"
          @click.stop="emit('close', relativePath)"
        >
          <XIcon class="size-3" />
        </span>
      </button>
      <div
        class="block min-w-10 max-h-7 min-h-7 bg-gradient-to-r from-transparent to-background aspect-square sticky top-0 right-0 h-full"
      ></div>
    </div>

    <Button
      v-if="canSave || isSaving"
      size="xs"
      :disabled="isSaving"
      :aria-label="isSaving ? 'Saving…' : 'Save file'"
      @click="emit('save')"
    >
      <LoaderIcon v-if="isSaving" class="animate-spin" />
      <SaveIcon v-else />
      Save
    </Button>
    <Button
      variant="ghost"
      size="icon-xs"
      :aria-label="treeCollapsed ? 'Expand file tree' : 'Collapse file tree'"
      class="text-muted-foreground"
      @click="emit('toggleTree')"
    >
      <PanelRightOpenIcon v-if="treeCollapsed" />
      <PanelRightCloseIcon v-else />
    </Button>
  </div>
</template>
