<script setup lang="ts">
import { computed, ref } from "vue";
import { useRouter, RouterLink } from "vue-router";
import { CheckIcon, ChevronsUpDownIcon, GitBranchIcon, Trash2Icon } from "@lucide/vue";
import {
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarMenuBadge,
} from "@/components/ui/sidebar";
import { useNotifications } from "@/modules/notifications/hooks/use-notifications";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Button } from "@/components/ui/button";
import {
  Combobox,
  ComboboxAnchor,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxTrigger,
  ComboboxViewport,
} from "@/components/ui/combobox";
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
const { unreadByWorktree } = useNotifications();

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
    <SidebarMenuSubItem v-for="w in worktrees" :key="w.id" class="flex items-center gap-0.5">
      <Combobox
        v-if="isMain(w)"
        v-model:open="switcherOpen"
        :filter-function="(list, term) => (list as string[]).filter(b => b.toLowerCase().includes(term.toLowerCase()))"
      >
        <ComboboxAnchor as-child>
          <ComboboxTrigger as-child>
            <Button
              :variant="activeWorktreeId === w.id ? 'secondary' : 'ghost'"
              size="icon-sm"
              class="shrink-0"
              title="Switch branch"
            >
              <ChevronsUpDownIcon class="size-3.5" />
            </Button>
          </ComboboxTrigger>
        </ComboboxAnchor>
        <ComboboxList align="start" :side-offset="4" class="w-100">
          <div class="px-2 pt-2">
            <ComboboxInput placeholder="Search branches..." auto-focus group-class="bg-input" />
          </div>
          <ComboboxEmpty>No branches found.</ComboboxEmpty>
          <ComboboxViewport class="max-h-48">
            <ComboboxItem
              v-for="branch in (branchData?.branches ?? [])"
              :key="branch"
              :value="branch"
              :disabled="checkoutBranch.isPending.value"
              class="py-1 text-sm"
              @select="selectBranch(branch)"
            >
              <CheckIcon
                class="size-3.5 shrink-0"
                :class="branch === currentBranch ? 'opacity-100' : 'opacity-0'"
              />
              <span class="truncate" :title="branch">{{ branch }}</span>
            </ComboboxItem>
          </ComboboxViewport>
        </ComboboxList>
      </Combobox>

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
            <SidebarMenuBadge v-if="(unreadByWorktree[w.id] ?? 0) > 0">
              {{ unreadByWorktree[w.id] }}
            </SidebarMenuBadge>
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
