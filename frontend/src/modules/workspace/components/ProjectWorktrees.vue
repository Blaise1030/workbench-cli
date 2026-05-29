<script setup lang="ts">
import { computed } from "vue";
import { useRouter } from "vue-router";
import { GitBranchIcon, Trash2Icon } from "@lucide/vue";
import {
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  branchesQueryOptions,
  useDeleteWorktreeMutation,
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

const router = useRouter();

const { data: worktrees } = useQuery(
  worktreesQueryOptions(() => props.projectId),
);
const { data: branchData } = useQuery(
  branchesQueryOptions(() => props.projectId),
);
const { data: network } = useQuery(networkSettingsQueryOptions());
const deleteWorktree = useDeleteWorktreeMutation(() => props.projectId);

const defaultBranch = computed(() => branchData.value?.defaultBranch ?? "main");

function label(w: Worktree) {
  return w.branch ?? w.path.split("/").pop() ?? "worktree";
}

function selectWorktree(w: Worktree) {
  if (network.value) {
    const targetPort = portForWorktreeBranch(
      isProdWorktreeBranch(w.branch, defaultBranch.value),
      network.value,
    );
    if (navigateToWorktreeOnPortIfNeeded(w.id, targetPort)) return;
  }
  emit("select", w);
}

async function removeWorktree(w: Worktree) {
  const name = label(w);
  if (
    !window.confirm(
      `Remove "${name}" from this project? Saved terminals will be removed. Files on disk are not deleted.`,
    )
  ) {
    return;
  }

  const wasActive = props.activeWorktreeId === w.id;
  const siblings =
    worktrees.value?.filter((other) => other.id !== w.id) ?? [];

  try {
    await deleteWorktree.mutateAsync(w.id);

    if (wasActive) {
      localStorage.removeItem("lastWorktreeId");
      if (siblings[0]) {
        selectWorktree(siblings[0]);
      } else {
        await router.push({ name: "home" });
      }
    }
  } catch (e) {
    window.alert(
      e instanceof Error ? e.message : "Failed to remove worktree",
    );
  }
}
</script>

<template>
  <SidebarMenuSub>
    <SidebarMenuSubItem v-for="w in worktrees" :key="w.id">
      <ContextMenu>
        <ContextMenuTrigger as-child>
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
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem variant="destructive" @select="removeWorktree(w)">
            <Trash2Icon />
            Remove worktree
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    </SidebarMenuSubItem>
    <SidebarMenuSubItem>
      <NewWorktreeDialog :project-id="projectId" />
    </SidebarMenuSubItem>
  </SidebarMenuSub>
</template>
