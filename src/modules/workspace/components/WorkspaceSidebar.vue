<script setup lang="ts">
import { ref, watch } from "vue";
import { useRouter, RouterLink } from "vue-router";
import { ChevronRightIcon, FolderGit2Icon, FolderOpenIcon, SettingsIcon } from "@lucide/vue";
import AddProjectDialog from "@/modules/workspace/components/AddProjectDialog.vue";
import ProjectWorktrees from "@/modules/workspace/components/ProjectWorktrees.vue";
import ThemeToggle from "@/modules/workspace/components/ThemeToggle.vue";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  SidebarMenu,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import SidebarMenuButtonChild from "@/components/ui/sidebar/SidebarMenuButtonChild.vue";
import {
  projectsQueryOptions,
  usePickProjectFolderMutation,
  type Worktree,
} from "@/modules/workspace/queries";
import { useQuery } from "@tanstack/vue-query";
import { isLocalHost } from "@/lib/is-local-host";
import { cn } from "@/lib/utils";

defineProps<{
  activeWorktreeId?: string;
}>();

const router = useRouter();
const addProjectOpen = ref(false);
const addProjectError = ref("");
const expandedProjects = ref<Record<string, boolean>>({});

const { data: projects } = useQuery(projectsQueryOptions());
const pickProjectFolder = usePickProjectFolderMutation();

watch(
  projects,
  (list) => {
    if (!list) return;
    for (const p of list) {
      if (expandedProjects.value[p.id] === undefined) {
        expandedProjects.value[p.id] = true;
      }
    }
  },
  { immediate: true },
);

function setExpanded(projectId: string, open: boolean) {
  expandedProjects.value = { ...expandedProjects.value, [projectId]: open };
}

function selectWorktree(worktree: Worktree) {
  localStorage.setItem("lastWorktreeId", worktree.id);
  router.push({ name: "workspace", params: { worktreeId: worktree.id } });
}

async function addProject() {
  addProjectError.value = "";
  if (!isLocalHost()) {
    addProjectOpen.value = true;
    return;
  }
  try {
    const result = await pickProjectFolder.mutateAsync();
    if (result.cancelled) return;
  } catch (e) {
    addProjectError.value =
      e instanceof Error ? e.message : "Failed to add project";
  }
}
</script>

<template>
  <div class="flex h-full min-h-0 flex-col bg-background">
    <div class="flex h-8 items-center justify-between px-3">
      <Button
        variant="ghost"
        size="icon-xs"
        aria-label="Add project from folder"
        :disabled="pickProjectFolder.isPending.value"
        @click="addProject"
      >
        <FolderOpenIcon />
      </Button>
      <div class="flex items-center gap-0.5">
        <ThemeToggle />
        <Button variant="ghost" size="icon-xs" as-child>
          <RouterLink to="/settings" aria-label="Settings">
            <SettingsIcon />
            <span class="sr-only">Settings</span>
          </RouterLink>
        </Button>
      </div>
    </div>

    <p
      v-if="addProjectError"
      class="border-b px-3 py-2 text-xs text-destructive"
    >
      {{ addProjectError }}
    </p>

    <div class="min-h-0 flex-1 overflow-y-auto p-1">
      <p
        v-if="!projects?.length"
        class="px-2 py-4 text-center text-sm text-muted-foreground"
      >
        No projects yet. Choose a folder to add a git repository.
      </p>

      <SidebarMenu>
        <SidebarMenuItem
          v-for="project in projects"
          :key="project.id"
          class="mb-0.5"
        >
          <Collapsible
            :open="expandedProjects[project.id] ?? true"
            @update:open="(v) => setExpanded(project.id, v)"
          >
            <CollapsibleTrigger as-child>
              <SidebarMenuButtonChild type="button" class="w-full">
                <ChevronRightIcon
                  class="size-4 shrink-0 transition-transform"
                  :class="
                    cn((expandedProjects[project.id] ?? true) && 'rotate-90')
                  "
                />
                <FolderGit2Icon />
                <span>{{ project.name }}</span>
              </SidebarMenuButtonChild>
            </CollapsibleTrigger>

            <CollapsibleContent>
              <ProjectWorktrees
                :project-id="project.id"
                :active-worktree-id="activeWorktreeId"
                @select="selectWorktree"
              />
            </CollapsibleContent>
          </Collapsible>
        </SidebarMenuItem>
      </SidebarMenu>
    </div>
  </div>

  <AddProjectDialog v-model:open="addProjectOpen" />
</template>
