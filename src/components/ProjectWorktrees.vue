<script setup lang="ts">
import { GitBranchIcon, PlusIcon } from "@lucide/vue";
import {
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar";
import { worktreesQueryOptions, type Worktree } from "@/api/workspace";
import { useQuery } from "@tanstack/vue-query";

const props = defineProps<{
  projectId: string;
  activeWorktreeId?: string;
}>();

const emit = defineEmits<{
  select: [worktree: Worktree];
  newWorktree: [];
}>();

const { data: worktrees } = useQuery(worktreesQueryOptions(() => props.projectId));

function label(w: Worktree) {
  return w.branch ?? w.path.split("/").pop() ?? "worktree";
}
</script>

<template>
  <SidebarMenuSub>
    <SidebarMenuSubItem v-for="w in worktrees" :key="w.id">
      <SidebarMenuSubButton
        as="button"
        type="button"
        :is-active="activeWorktreeId === w.id"
        :class="!w.isLinked && 'opacity-60'"
        @click="emit('select', w)"
      >
        <GitBranchIcon />
        <span>{{ label(w) }}</span>
        <span
          v-if="!w.isLinked"
          class="ml-auto text-[10px] uppercase text-muted-foreground"
        >
          missing
        </span>
      </SidebarMenuSubButton>
    </SidebarMenuSubItem>
    <SidebarMenuSubItem>
      <SidebarMenuSubButton
        as="button"
        type="button"
        size="sm"
        class="text-muted-foreground"
        @click="emit('newWorktree')"
      >
        <PlusIcon />
        <span>New worktree</span>
      </SidebarMenuSubButton>
    </SidebarMenuSubItem>
  </SidebarMenuSub>
</template>
