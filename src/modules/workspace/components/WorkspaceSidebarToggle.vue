<script setup lang="ts">
import { PanelLeftIcon } from "@lucide/vue";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useWorkspaceSidebar } from "@/modules/workspace/hooks/workspace-sidebar";

const props = defineProps<{
  class?: string;
}>();

const { isCollapsed, toggle } = useWorkspaceSidebar();
</script>

<template>
  <Button
    variant="ghost"
    size="icon-xs"
    :class="cn('mx-auto my-auto shrink-0', props.class)"
    :aria-label="isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'"
    :aria-expanded="!isCollapsed"
    @click="toggle"
  >
    <PanelLeftIcon :class="cn('cn-rtl-flip', isCollapsed && 'opacity-60')" />
  </Button>
</template>
