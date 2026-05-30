<script setup lang="ts">
import { useRouter, RouterLink } from "vue-router";
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
  activeWorktreeId?: string;
}>();

const router = useRouter();

const { data: worktrees } = useQuery(
  worktreesQueryOptions(() => props.projectId),
);
const deleteWorktree = useDeleteWorktreeMutation(() => props.projectId);

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
  const siblings =
    worktrees.value?.filter((other) => other.id !== w.id) ?? [];

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
    <SidebarMenuSubItem v-for="w in worktrees" :key="w.id">
      <ContextMenu>
        <ContextMenuTrigger as-child>
          <SidebarMenuSubButton
            as-child
            :is-active="activeWorktreeId === w.id"
            :class="
              cn(
                'w-fit max-w-full whitespace-nowrap [&>span:last-child]:truncate-none',
                !w.isLinked && 'opacity-60',
              )
            "
          >
            <RouterLink :to="worktreePath(w.id)" @click="rememberWorktree(w.id)">
              <GitBranchIcon />
              <span>{{ label(w) }}</span>
              <span
                v-if="!w.isLinked"
                class="text-[10px] uppercase text-muted-foreground"
              >
                missing
              </span>
            </RouterLink>
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
