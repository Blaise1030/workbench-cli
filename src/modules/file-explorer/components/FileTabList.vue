<script setup lang="ts">
import { nextTick, ref, watch } from "vue";
import { XIcon } from "@lucide/vue";
import { cn } from "@/lib/utils";
import { basename } from "@/modules/file-explorer/lib/file-tabs";
import FileTabIcon from "@/modules/file-explorer/components/FileTabIcon.vue";

const props = defineProps<{
  tabs: string[];
  activePath: string | null;
  dirtyPaths?: Set<string>;
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
}>();

function tabClass(relativePath: string) {
  const isActive = relativePath === props.activePath;
  return cn(
    "group inline-flex h-7 max-w-[11rem] shrink-0 items-center gap-1.5 rounded-md px-2 text-[0.8125rem] leading-none transition-colors",
    isActive
      ? "bg-background text-foreground shadow-sm ring-1 ring-border/80"
      : "bg-muted/40 text-muted-foreground hover:bg-muted/70 hover:text-foreground",
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
    ref="tabListEl"
    class="flex min-h-9 shrink-0 items-center gap-1 overflow-x-auto px-2 py-1"
    role="tablist"
    aria-label="Open files"
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
  </div>
</template>
