<script setup lang="ts">
import { PanelLeftIcon } from "@lucide/vue";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useWorkspaceSidebar } from "@/composables/workspace-sidebar";

const props = defineProps<{
  class?: string;
}>();

const { isCollapsed, toggle } = useWorkspaceSidebar();
</script>

<template>
  <Button
    variant="ghost"
    size="icon-xs"
    :class="cn('h-6 w-6 mx-auto my-auto shrink-0 rounded-none', props.class)"
    :aria-label="isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'"
    :aria-expanded="!isCollapsed"
    @click="toggle"
  >
    <PanelLeftIcon
      :class="cn('cn-rtl-flip size-4', isCollapsed && 'opacity-60')"
    />
  </Button>
</template>
