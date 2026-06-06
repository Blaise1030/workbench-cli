<script setup lang="ts">
import { useDebounceFn, useLocalStorage } from "@vueuse/core";
import { computed, ref, watch } from "vue";
import { RouterLink, useRouter } from "vue-router";
import { useQueryClient } from "@tanstack/vue-query";
import {
  ChevronRightIcon,
  FolderGit2Icon,
  FolderPlusIcon,
  SettingsIcon,
} from "@lucide/vue";
import AgentKindIcon from "@/modules/workspace/components/AgentKindIcon.vue";
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
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import {
  projectsQueryOptions,
  worktreesQueryOptions,
  usePickProjectFolderMutation,
} from "@/modules/workspace/queries";
import { useQuery, useQueries } from "@tanstack/vue-query";
import { isLocalHost } from "@/lib/is-local-host";
import { cn } from "@/lib/utils";
import {
  agentStatusClass,
  formatAgentStatus,
} from "@/modules/sessions/agent-status";
import { useSessionsQuery } from "@/modules/sessions/queries";
import { useRoute } from "vue-router";
import { useTerminalSessions } from "@/modules/terminal/hooks/terminal-sessions";
import { openProjectWorkspace } from "@/modules/workspace/lib/open-project-workspace";

const STORAGE_KEY_EXPANDED_PROJECTS = "workbench:workspace-projects-expanded";
const STORAGE_KEY_AGENTS_PANEL_SIZE = "workbench:workspace-sidebar-agents-size";
const DEFAULT_AGENTS_PANEL_SIZE = 30;
const MIN_AGENTS_PANEL_SIZE = 10;
const MIN_PROJECTS_PANEL_SIZE = 20;

function clampAgentsPanelSize(size: number): number {
  const max = 100 - MIN_PROJECTS_PANEL_SIZE;
  return Math.min(max, Math.max(MIN_AGENTS_PANEL_SIZE, Math.round(size)));
}

const router = useRouter();
const queryClient = useQueryClient();
const addProjectOpen = ref(false);
const addProjectError = ref("");
const expandedProjects = useLocalStorage<Record<string, boolean>>(
  STORAGE_KEY_EXPANDED_PROJECTS,
  {},
);
const agentsPanelSize = useLocalStorage(
  STORAGE_KEY_AGENTS_PANEL_SIZE,
  DEFAULT_AGENTS_PANEL_SIZE,
);
const projectsPanelDefaultSize = computed(
  () => 100 - clampAgentsPanelSize(agentsPanelSize.value),
);
const agentsPanelDefaultSize = computed(() =>
  clampAgentsPanelSize(agentsPanelSize.value),
);

const persistAgentsPanelSize = useDebounceFn((size: number) => {
  agentsPanelSize.value = clampAgentsPanelSize(size);
}, 300);

function onVerticalLayout(sizes: number[]) {
  const agentsSize = sizes[1];
  if (typeof agentsSize === "number" && Number.isFinite(agentsSize)) {
    persistAgentsPanelSize(agentsSize);
  }
}
const { data: projects } = useQuery(projectsQueryOptions());
const pickProjectFolder = usePickProjectFolderMutation();

const allWorktreeQueries = useQueries({
  queries: computed(() =>
    (projects.value ?? []).map((p) => worktreesQueryOptions(p.id)),
  ),
});

const worktreeContextMap = computed(() => {
  const map = new Map<string, { branch: string | null; projectName: string }>();
  const projectList = projects.value ?? [];
  for (let i = 0; i < projectList.length; i++) {
    const project = projectList[i];
    const worktrees = allWorktreeQueries.value[i]?.data ?? [];
    for (const wt of worktrees) {
      map.set(wt.id, { branch: wt.branch, projectName: project.name });
    }
  }
  return map;
});

const props = defineProps<{
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

async function addProject() {
  addProjectError.value = "";
  if (!isLocalHost()) {
    addProjectOpen.value = true;
    return;
  }
  try {
    const result = await pickProjectFolder.mutateAsync();
    if (result.cancelled) return;
    setExpanded(result.project.id, true);
    await openProjectWorkspace(queryClient, router, result.project);
  } catch (e) {
    addProjectError.value =
      e instanceof Error ? e.message : "Failed to add project";
  }
}

const { data: sessionsData } = useSessionsQuery();
const activeSessions = computed(() =>
  (sessionsData.value ?? []).filter((s) => s.isAlive),
);

const route = useRoute();
const terminalSessions = useTerminalSessions();

function sessionTitle(id: string, fallback: string): string {
  return terminalSessions.tabLabel(id) || fallback;
}
</script>

<template>
  <div class="flex h-full min-h-0 w-full flex-col overflow-hidden">
    <ResizablePanelGroup
      direction="vertical"
      class="h-full min-h-0"
      @layout="onVerticalLayout"
    >
      <!-- Projects panel -->
      <ResizablePanel
        :default-size="projectsPanelDefaultSize"
        :min-size="MIN_PROJECTS_PANEL_SIZE"
        class="flex min-h-0 flex-col"
      >
        <div class="min-h-0 flex-1 overflow-y-auto">
          <div class="flex min-h-full flex-col">
            <div class="flex flex-1 flex-col px-1">
              <!-- Header — sticky, fades into project list below -->
              <div class="sticky top-0 z-10 flex h-8 shrink-0 items-center justify-between bg-gradient-to-b from-background to-transparent">
                <div class="flex items-center ml-auto">
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

              <p
                v-if="!projects?.length"
                class="px-2 py-4 text-center text-sm text-muted-foreground"
              >
                No projects yet. Choose a folder to add a project.
              </p>

              <SidebarMenu class="relative">
                <SidebarMenuItem
                  v-for="project in projects"
                  :key="project.id"
                  class="mb-0"
                >
                  <Collapsible
                    :open="expandedProjects[project.id] ?? true"
                    @update:open="(v) => setExpanded(project.id, v)"
                  >
                    <CollapsibleTrigger as-child>
                      <SidebarMenuButtonChild type="button" class="w-full">
                        <ChevronRightIcon
                          class="size-4 shrink-0 transition-transform"
                          :class="cn((expandedProjects[project.id] ?? true) && 'rotate-90')"
                        />
                        <FolderGit2Icon />
                        <span>{{ project.name }}</span>
                      </SidebarMenuButtonChild>
                    </CollapsibleTrigger>

                    <CollapsibleContent class="mt-1">
                      <ProjectWorktrees
                        :project-id="project.id"
                        :repo-path="project.repoPath"
                        :is-git-repo="project.isGitRepo"
                        :active-worktree-id="activeWorktreeId"
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
                    <FolderPlusIcon class="shrink-0 stroke-muted-foreground" />
                    <span class="shrink-0 whitespace-nowrap">Add project</span>
                  </SidebarMenuButtonChild>
                </SidebarMenuItem>
              </SidebarMenu>

              <!-- Footer — sticky, fades into project list above -->
              <div class="sticky bottom-0 z-10 mt-auto h-8 shrink-0 bg-gradient-to-t from-background to-transparent" />
            </div>
          </div>
        </div>
      </ResizablePanel>

      <ResizableHandle with-handle class="!h-px !w-full [&_[data-slot=resize-grip]]:h-1 [&_[data-slot=resize-grip]]:w-6" />

      <!-- Active agents panel -->
      <ResizablePanel
        :default-size="agentsPanelDefaultSize"
        :min-size="MIN_AGENTS_PANEL_SIZE"
        class="flex min-h-0 flex-col"
      >
        <div class="min-h-0 flex-1 overflow-y-auto px-1 pt-1">
          <div v-if="activeSessions.length > 0" class="flex flex-col gap-0.5">
            <RouterLink
              v-for="s in activeSessions"
              :key="s.id"
              :to="{ name: 'terminal', params: { worktreeId: s.worktreeId, terminalId: s.id } }"
              class="flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              :class="{ 'bg-sidebar-accent text-sidebar-accent-foreground': route.params.terminalId === s.id }"
            >
              <AgentKindIcon :kind="s.agentKind" class="mt-0.5 size-4" />
              <div class="min-w-0 flex-1">
                <div class="flex items-baseline gap-2">
                  <div class="min-w-0 flex-1 truncate text-foreground">
                    {{ sessionTitle(s.id, s.title) }}
                  </div>
                  <span
                    v-if="formatAgentStatus(s.agentStatus)"
                    class="shrink-0 text-[10px] font-medium"
                    :class="agentStatusClass(s.agentStatus)"
                  >
                    {{ formatAgentStatus(s.agentStatus) }}
                  </span>
                </div>
                <div
                  v-if="worktreeContextMap.get(s.worktreeId)"
                  class="truncate text-muted-foreground"
                >
                  {{ worktreeContextMap.get(s.worktreeId)?.projectName }}<template v-if="worktreeContextMap.get(s.worktreeId)?.branch"> · {{ worktreeContextMap.get(s.worktreeId)?.branch }}</template>
                </div>
              </div>
            </RouterLink>
          </div>
          <div v-else class="flex h-full items-center justify-center">
            <p class="text-xs text-muted-foreground">No active agents</p>
          </div>
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>
  </div>

  <AddProjectDialog v-model:open="addProjectOpen" />
</template>
