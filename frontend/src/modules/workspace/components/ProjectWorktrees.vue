<script setup lang="ts">
import { computed, ref } from "vue";
import { useRouter, RouterLink } from "vue-router";
import { ChevronsUpDownIcon, GitBranchIcon, Trash2Icon } from "@lucide/vue";
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
import { Button } from "@/components/ui/button";
import BranchCombobox from "@/modules/workspace/components/BranchCombobox.vue";
import {
  branchesQueryOptions,
  useCheckoutBranchMutation,
  useDeleteWorktreeMutation,
  worktreesQueryOptions,
  type Worktree,
} from "@/modules/workspace/queries";
import { worktreePath } from "@/modules/workspace/lib/worktree-env";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/vue-query";
import NewWorktreeDialog from "@/modules/workspace/components/NewWorktreeDialog.vue";

const props = defineProps<{
  projectId: string;
  repoPath: string;
  activeWorktreeId?: string;
}>();

const router = useRouter();

const { data: worktreesRaw } = useQuery(
  worktreesQueryOptions(() => props.projectId),
);

const worktrees = computed(() => {
  if (!worktreesRaw.value) return [];
  const main = worktreesRaw.value.find((w) => w.path === props.repoPath);
  const rest = worktreesRaw.value.filter((w) => w.path !== props.repoPath);
  return main ? [main, ...rest] : rest;
});

function isMain(w: Worktree) {
  return w.path === props.repoPath;
}

const deleteWorktree = useDeleteWorktreeMutation(() => props.projectId);
const checkoutBranch = useCheckoutBranchMutation(() => props.projectId);

const mainWorktree = computed(() => worktrees.value.find((w) => isMain(w)));
const currentBranch = computed(() => mainWorktree.value?.branch ?? null);

const switcherOpen = ref(false);

const { data: branchData } = useQuery({
  ...branchesQueryOptions(() => props.projectId),
  enabled: computed(() => switcherOpen.value),
});

async function selectBranch(branch: string) {
  await checkoutBranch.mutateAsync(branch);
  switcherOpen.value = false;
}

function label(w: Worktree) {
  return w.branch ?? w.path.split("/").pop() ?? "worktree";
}

function rememberWorktree(worktreeId: string) {
  localStorage.setItem("lastWorktreeId", worktreeId);
}

async function removeWorktree(w: Worktree) {
  const name = label(w);
  if (
    !window.confirm(
      `Remove "${name}"? This deletes the git worktree and its branch on disk, and removes its saved terminals.`,
    )
  ) {
    return;
  }

  const wasActive = props.activeWorktreeId === w.id;
  const siblings = worktrees.value?.filter((other) => other.id !== w.id) ?? [];

  try {
    await deleteWorktree.mutateAsync(w.id);

    if (wasActive) {
      localStorage.removeItem("lastWorktreeId");
      if (siblings[0]) {
        rememberWorktree(siblings[0].id);
        await router.push(worktreePath(siblings[0].id));
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
    <SidebarMenuSubItem v-for="w in worktrees" :key="w.id" class="flex items-center gap-px">
      <BranchCombobox
        v-if="isMain(w)"
        :model-value="currentBranch ?? ''"
        v-model:open="switcherOpen"
        :branches="branchData?.branches ?? []"
        :disabled="checkoutBranch.isPending.value"
        list-class="w-100"
        @update:model-value="selectBranch"
      >
        <template #trigger>
          <Button
            :variant="activeWorktreeId === w.id ? 'secondary' : 'ghost'"
            size="icon-sm"
            class="shrink-0"
            title="Switch branch"
          >
            <ChevronsUpDownIcon class="size-3.5" />
          </Button>
        </template>
      </BranchCombobox>

      <ContextMenu>
        <ContextMenuTrigger as-child>
          <SidebarMenuSubButton
            as-child
            :is-active="activeWorktreeId === w.id"
            :class="cn('w-fit', !w.isLinked && 'opacity-60')"
          >
            <RouterLink
              :to="worktreePath(w.id)"
              class="flex min-w-0 flex-nowrap items-center gap-2"
              @click="rememberWorktree(w.id)"
            >
              <GitBranchIcon v-if="!isMain(w)" class="shrink-0" />
              <span :class="isMain(w) ? 'truncate' : 'shrink-0 whitespace-nowrap'">{{ label(w) }}</span>
              <span
                v-if="!isMain(w) && !w.isLinked"
                class="shrink-0 whitespace-nowrap text-[10px] uppercase text-muted-foreground"
              >
                missing
              </span>
            </RouterLink>
          </SidebarMenuSubButton>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem
            variant="destructive"
            :disabled="isMain(w)"
            @select="removeWorktree(w)"
          >
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
