<script setup lang="ts">
import { computed, provide } from "vue";
import { useDebounceFn, useLocalStorage } from "@vueuse/core";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import WorkspaceSidebar from "@/modules/workspace/components/WorkspaceSidebar.vue";
import WorkspaceSidebarPanelBridge from "@/modules/workspace/components/WorkspaceSidebarPanelBridge.vue";
import {
  createWorkspaceSidebarStore,
  workspaceSidebarKey,
} from "@/modules/workspace/hooks/workspace-sidebar";

defineProps<{
  activeWorktreeId?: string;
}>();

const STORAGE_KEY = "workbench:workspace-sidebar-width";
const DEFAULT_WIDTH_PX = 200;
const MIN_WIDTH_PX = 160;
const MAX_WIDTH_PX = 480;

function clampWidth(width: number): number {
  return Math.min(MAX_WIDTH_PX, Math.max(MIN_WIDTH_PX, Math.round(width)));
}

const sidebarWidth = useLocalStorage(STORAGE_KEY, DEFAULT_WIDTH_PX);

const workspaceSidebar = createWorkspaceSidebarStore();
provide(workspaceSidebarKey, workspaceSidebar);

const sidebarDefaultSize = computed(() => clampWidth(sidebarWidth.value));

const persistSidebarWidth = useDebounceFn((width: number) => {
  sidebarWidth.value = clampWidth(width);
}, 300);

function onLayout(sizes: number[]) {
  const next = sizes[0];
  if (typeof next === "number" && Number.isFinite(next)) {
    persistSidebarWidth(next);
  }
}

</script>

<template>
  <div class="flex h-screen flex-col">
    <ResizablePanelGroup
      direction="horizontal"
      class="min-h-0 flex-1"
      @layout="onLayout"
    >
      <ResizablePanel
        id="workspace-sidebar"
        v-slot="panel"
        collapsible
        :collapsed-size="0"
        :default-size="sidebarDefaultSize"
        size-unit="px"
        :min-size="MIN_WIDTH_PX"
        :max-size="MAX_WIDTH_PX"
      >
        <WorkspaceSidebarPanelBridge
          :collapse="panel.collapse"
          :expand="panel.expand"
          :is-collapsed="panel.isCollapsed"
        />
        <WorkspaceSidebar :active-worktree-id="activeWorktreeId" />
      </ResizablePanel>
      <ResizableHandle v-show="!workspaceSidebar.isCollapsed.value" with-handle />
      <ResizablePanel :min-size="30" class="flex min-h-0 flex-col">
        <div class="flex h-full min-h-0 flex-1 flex-col">
          <slot />
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>
  </div>
</template>
