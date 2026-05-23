<script setup lang="ts">
import {
  FolderTreeIcon,
  GitBranchIcon,
  PlusIcon,
  TerminalIcon,
} from "@lucide/vue";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { WorkspacePanelType } from "@/types/workspace-panel";

const emit = defineEmits<{
  add: [type: WorkspacePanelType];
}>();
</script>

<template>
  <DropdownMenu>
    <DropdownMenuTrigger as-child>
      <Button variant="ghost" size="icon-xs" aria-label="Add panel">
        <PlusIcon />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" class="w-48">
      <DropdownMenuItem @select="emit('add', 'terminal')">
        <TerminalIcon />
        Terminal
      </DropdownMenuItem>
      <DropdownMenuItem @select="emit('add', 'git')">
        <GitBranchIcon />
        Git
      </DropdownMenuItem>
      <DropdownMenuItem @select="emit('add', 'explorer')">
        <FolderTreeIcon />
        File explorer
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
