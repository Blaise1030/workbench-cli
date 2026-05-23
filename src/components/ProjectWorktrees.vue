<script setup lang="ts">
import { GitBranchIcon } from "@lucide/vue";
import {
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar";
import { worktreesQueryOptions, type Worktree } from "@/api/workspace";
import { useQuery } from "@tanstack/vue-query";
import NewWorktreeDialog from "@/components/NewWorktreeDialog.vue";

const props = defineProps<{
  projectId: string;
  activeWorktreeId?: string;
}>();

const emit = defineEmits<{
  select: [worktree: Worktree];
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
      <NewWorktreeDialog :project-id="projectId" />
    </SidebarMenuSubItem>
  </SidebarMenuSub>
</template>
