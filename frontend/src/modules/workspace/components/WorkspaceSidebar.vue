<script setup lang="ts">
import { useLocalStorage } from "@vueuse/core";
import { ref, watch } from "vue";
import { useRouter, RouterLink } from "vue-router";
import {
  ChevronRightIcon,
  FolderGit2Icon,
  FolderPlusIcon,
  SettingsIcon,
} from "@lucide/vue";
import AddProjectDialog from "@/modules/workspace/components/AddProjectDialog.vue";
import ProjectWorktrees from "@/modules/workspace/components/ProjectWorktrees.vue";
import ThemeToggle from "@/modules/workspace/components/ThemeToggle.vue";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { SidebarMenu, SidebarMenuItem } from "@/components/ui/sidebar";
import SidebarMenuButtonChild from "@/components/ui/sidebar/SidebarMenuButtonChild.vue";
import {
  projectsQueryOptions,
  usePickProjectFolderMutation,
  type Worktree,
} from "@/modules/workspace/queries";
import { useQuery } from "@tanstack/vue-query";
import { isLocalHost } from "@/lib/is-local-host";
import { cn } from "@/lib/utils";

const STORAGE_KEY_EXPANDED_PROJECTS = "workbench:workspace-projects-expanded";

const router = useRouter();
const addProjectOpen = ref(false);
const addProjectError = ref("");
const expandedProjects = useLocalStorage<Record<string, boolean>>(
  STORAGE_KEY_EXPANDED_PROJECTS,
  {},
);

const { data: projects } = useQuery(projectsQueryOptions());
const pickProjectFolder = usePickProjectFolderMutation();

defineProps<{
  activeWorktreeId?: string;
}>();

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
  <div class="flex h-full min-h-0 flex-col">
    <p
      v-if="addProjectError"
      class="border-b px-3 py-2 text-xs text-destructive"
    >
      {{ addProjectError }}
    </p>

    <div class="min-h-0 flex-1 overflow-y-auto px-2">
      <p
        v-if="!projects?.length"
        class="px-2 py-4 text-center text-sm text-muted-foreground"
      >
        No projects yet. Choose a folder to add a git repository.
      </p>

      <SidebarMenu class="relative">
        <div
          class="flex sticky top-0 z-50 left-0 w-full h-8 bg-linear-to-b from-background to-transparent items-center justify-end"
        >
          <ThemeToggle />
          <Button variant="ghost" size="icon-xs" as-child>
            <RouterLink to="/settings" aria-label="Settings">
              <SettingsIcon />
              <span class="sr-only">Settings</span>
            </RouterLink>
          </Button>
        </div>
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
        <SidebarMenuItem class="flex">
          <SidebarMenuButtonChild
            type="button"
            size="sm"
            class="h-7 w-fit text-muted-foreground"
            :disabled="pickProjectFolder.isPending.value"
            @click="addProject"
          >
            <FolderPlusIcon />
            <span>Add project</span>
          </SidebarMenuButtonChild>
        </SidebarMenuItem>
        <div
          class="bg-gradient-to-t from-background to-transparent sticky bottom-0 left-0 z-50 h-8"
        ></div>
      </SidebarMenu>
    </div>
  </div>

  <AddProjectDialog v-model:open="addProjectOpen" />
</template>
