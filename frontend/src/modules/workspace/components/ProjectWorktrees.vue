<script setup lang="ts">
import { computed } from "vue";
import { GitBranchIcon } from "@lucide/vue";
import {
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar";
import {
  branchesQueryOptions,
  worktreesQueryOptions,
  type Worktree,
} from "@/modules/workspace/queries";
import {
  isProdWorktreeBranch,
  navigateToWorktreeOnPortIfNeeded,
  portForWorktreeBranch,
} from "@/modules/workspace/lib/worktree-env";
import { networkSettingsQueryOptions } from "@/modules/settings/queries/settings";
import { useQuery } from "@tanstack/vue-query";
import NewWorktreeDialog from "@/modules/workspace/components/NewWorktreeDialog.vue";

const props = defineProps<{
  projectId: string;
  activeWorktreeId?: string;
}>();

const emit = defineEmits<{
  select: [worktree: Worktree];
}>();

const { data: worktrees } = useQuery(worktreesQueryOptions(() => props.projectId));
const { data: branchData } = useQuery(branchesQueryOptions(() => props.projectId));
const { data: network } = useQuery(networkSettingsQueryOptions());

const defaultBranch = computed(() => branchData.value?.defaultBranch ?? "main");

function label(w: Worktree) {
  return w.branch ?? w.path.split("/").pop() ?? "worktree";
}

function selectWorktree(w: Worktree) {
  if (!network.value) {
    emit("select", w);
    return;
  }
  const targetPort = portForWorktreeBranch(
    isProdWorktreeBranch(w.branch, defaultBranch.value),
    network.value,
  );
  if (navigateToWorktreeOnPortIfNeeded(w.id, targetPort, network.value)) return;
  emit("select", w);
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
        @click="selectWorktree(w)"
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
