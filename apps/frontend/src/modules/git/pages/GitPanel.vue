<script setup lang="ts">
import { computed, inject, ref, toValue, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import {
  GitBranchIcon,
  Settings2Icon,

  Columns2Icon,
  AlignJustifyIcon,
  ChevronsDownUpIcon,
  ChevronsUpDownIcon,
  AlignLeftIcon,
  SquareIcon,
  SlashIcon,
  ChevronDownIcon,
  PlusIcon,
  MinusIcon,
  Trash2Icon,
  ListChecksIcon,
} from "@lucide/vue";
import {
  gitActionsForSelection,
  gitDiffQueryOptions,
  gitStatusQueryOptions,
  useGitCommitMutation,
  useGitFileActionsMutation,
  type GitFileAction,
} from "@/modules/git/queries";
import { worktreeQueryOptions } from "@/modules/workspace/queries";
import { useProjectIsGitRepo } from "@/modules/workspace/hooks/use-project-is-git-repo";
import GitDiffCodeView from "@/modules/git/components/GitDiffCodeView.vue";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { patchToCodeViewItems } from "@/modules/git/lib/git-diff-items";
import {
  selectAllPathsState,
  selectablePathsFromDiffItems,
} from "@/modules/git/lib/git-diff-selection";
import { Checkbox } from "@/components/ui/checkbox";
import {
  GIT_PANEL_DEFAULT_TAB,
  GIT_PANEL_TAB_SCOPES,
  normalizeGitPanelTabScope,
  useGitPanelStorage,
  type GitPanelTabScope,
} from "@/modules/git/lib/git-panel-storage";
import { useQueries, useQuery } from "@tanstack/vue-query";
import type { DiffIndicators } from "@pierre/diffs";
import { contextQueueGitItemIdsKey } from "@/modules/context-queue/lib/context-queue-keys";
import { PanelLoading } from "@/components/ui/panel-loading";
import IsoAppsOutage from "@/assets/isocons/IsoAppsOutage.vue";
import IsoErrorMed from "@/assets/isocons/IsoErrorMed.vue";
import IsoCheckCircle from "@/assets/isocons/IsoCheckCircle.vue";

const props = defineProps<{
  worktreeId: string;
}>();

const route = useRoute();
const router = useRouter();

const ownsRoute = computed(() => route.name === "git");

const gitState = useGitPanelStorage(() => props.worktreeId);

function resolveActiveTab(): GitPanelTabScope {
  const stored = normalizeGitPanelTabScope(gitState.value.activeTab);
  if (stored) return stored;
  const fromRoute = normalizeGitPanelTabScope(route.query.tab);
  if (fromRoute) return fromRoute;
  return GIT_PANEL_DEFAULT_TAB;
}

/** Local tab state updates immediately; route/storage sync without blocking the UI. */
const activeTab = ref<GitPanelTabScope>(resolveActiveTab());

function collapsedIdsForTab(tab: GitPanelTabScope): string[] {
  return gitState.value.collapsedByTab?.[tab] ?? [];
}

function setCollapsedIdsForTab(tab: GitPanelTabScope, ids: string[]) {
  gitState.value = {
    ...gitState.value,
    collapsedByTab: {
      ...gitState.value.collapsedByTab,
      [tab]: ids,
    },
  };
}

watch(
  () => route.query.tab,
  (tab) => {
    if (!ownsRoute.value) return;
    const normalized = normalizeGitPanelTabScope(tab);
    if (normalized) {
      if (tab !== normalized) {
        router.replace({ query: { ...route.query, tab: normalized } });
      }
      if (activeTab.value !== normalized) activeTab.value = normalized;
      if (gitState.value.activeTab !== normalized) {
        gitState.value = { ...gitState.value, activeTab: normalized };
      }
      return;
    }
    router.replace({
      query: {
        ...route.query,
        tab:
          normalizeGitPanelTabScope(gitState.value.activeTab) ??
          GIT_PANEL_DEFAULT_TAB,
      },
    });
  },
  { immediate: true },
);

watch(activeTab, (tab) => {
  if (gitState.value.activeTab !== tab) {
    gitState.value = { ...gitState.value, activeTab: tab };
  }
  if (ownsRoute.value && route.query.tab !== tab) {
    router.replace({ query: { ...route.query, tab } });
  }
});

watch(
  () => props.worktreeId,
  () => {
    const tab = normalizeGitPanelTabScope(gitState.value.activeTab) ?? GIT_PANEL_DEFAULT_TAB;
    activeTab.value = tab;
    if (ownsRoute.value) {
      router.replace({ query: { ...route.query, tab } });
    }
  },
);

const showBackgrounds = ref(true);
const showLineNumbers = ref(true);
const wordWrap = ref(false);
const diffIndicators = ref<DiffIndicators>("classic");
const diffStyle = ref<"unified" | "split">("unified");
const allCollapsed = ref(false);
const selectedPaths = ref<string[]>([]);

const gitFileActions = useGitFileActionsMutation(() => props.worktreeId);
const gitCommit = useGitCommitMutation(() => props.worktreeId);

const commitOpen = ref(false);
const commitMessage = ref("");

const collapseAllActive = computed(() => {
  const items = diffItems.value;
  if (!items.length) return false;
  if (allCollapsed.value) return true;
  const collapsed = new Set(collapsedIdsForTab(activeTab.value));
  return items.every((item) => collapsed.has(item.id));
});

function toggleCollapseAll() {
  if (collapseAllActive.value) {
    allCollapsed.value = false;
    setCollapsedIdsForTab(activeTab.value, []);
    return;
  }
  allCollapsed.value = true;
}

const { data: worktree, isLoading: worktreeLoading } = useQuery(
  worktreeQueryOptions(() => props.worktreeId),
);

const isGitRepo = useProjectIsGitRepo(() => worktree.value?.projectId);

const gitEnabled = computed(
  () =>
    Boolean(worktree.value?.isLinked) &&
    isGitRepo.value === true &&
    !worktreeLoading.value,
);

const {
  data: gitStatus,
  isLoading: statusLoading,
  isError: statusError,
  error: statusErrorObj,
} = useQuery({
  ...gitStatusQueryOptions(() => props.worktreeId),
  enabled: gitEnabled,
});

const gitDiffQueries = useQueries({
  queries: computed(() =>
    GIT_PANEL_TAB_SCOPES.map((scope) => ({
      ...gitDiffQueryOptions(() => props.worktreeId, scope, () => null),
      enabled: gitEnabled.value,
    })),
  ),
});

const gitDiffByScope = computed(() => {
  const map = new Map<
    GitPanelTabScope,
    (typeof gitDiffQueries.value)[number]
  >();
  GIT_PANEL_TAB_SCOPES.forEach((scope, index) => {
    const query = gitDiffQueries.value[index];
    if (query) map.set(scope, query);
  });
  return map;
});

const { data: untrackedDiffData } = useQuery({
  ...gitDiffQueryOptions(() => props.worktreeId, "untracked", () => null),
  enabled: gitEnabled,
});

const changedFiles = computed(() => gitStatus.value?.files ?? []);

const diffItemsByTab = computed(() => {
  const items = {} as Record<GitPanelTabScope, ReturnType<typeof patchToCodeViewItems>>;
  const statusFiles = changedFiles.value;
  for (const scope of GIT_PANEL_TAB_SCOPES) {
    const patch = toValue(gitDiffByScope.value.get(scope)?.data)?.patch ?? "";
    let scopeItems = patchToCodeViewItems(
      patch,
      `${props.worktreeId}-${scope}`,
    );
    if (scope === "unstaged") {
      const ignoredPaths = new Set(
        statusFiles.filter((f) => f.unstaged === "ignored").map((f) => f.path),
      );
      const untrackedPatch = untrackedDiffData.value?.patch ?? "";
      const untrackedItems = patchToCodeViewItems(untrackedPatch, `${props.worktreeId}-untracked`)
        .filter((item) => {
          if (ignoredPaths.has(item.id)) return false;
          const firstSegment = item.id.split("/")[0];
          return !firstSegment.startsWith(".");
        });
      scopeItems = [...scopeItems, ...untrackedItems];
    }
    items[scope] = scopeItems;
  }
  return items;
});

const diffItems = computed(() => diffItemsByTab.value[activeTab.value]);

const gitItemIdsRef = inject(contextQueueGitItemIdsKey, null);
watch(
  diffItems,
  (items) => {
    if (gitItemIdsRef) {
      gitItemIdsRef.value = items.map((item) => item.id);
    }
  },
  { immediate: true },
);

function isDiffPending(tab: GitPanelTabScope): boolean {
  const query = gitDiffByScope.value.get(tab);
  if (!query) return true;
  return toValue(query.isPending) ?? true;
}

watch(allCollapsed, (collapsed) => {
  if (!diffItems.value.length) return;
  setCollapsedIdsForTab(
    activeTab.value,
    collapsed ? diffItems.value.map((item) => item.id) : [],
  );
});

function onExpandOneDiff(itemId: string) {
  allCollapsed.value = false;
  setCollapsedIdsForTab(
    activeTab.value,
    diffItems.value.map((item) => item.id).filter((id) => id !== itemId),
  );
}

const displayBranch = computed(
  () => gitStatus.value?.branch ?? worktree.value?.branch ?? "detached",
);

const unstagedCount = computed(
  () => changedFiles.value.filter((f) => {
    if (!f.unstaged || f.unstaged === "ignored") return false;
    const firstSegment = f.path.split("/")[0];
    return !firstSegment.startsWith(".");
  }).length,
);
/** Files with anything in the index vs HEAD. */
const stagedCount = computed(
  () => changedFiles.value.filter((f) => f.staged != null).length,
);

/** Tab badges follow `git status` buckets, not diff hunk count (diff can differ). */
function tabCount(tab: GitPanelTabScope): number {
  return tab === "staged" ? stagedCount.value : unstagedCount.value;
}

const canCommit = computed(() => stagedCount.value > 0);

const commitDisabled = computed(
  () =>
    !gitEnabled.value ||
    statusLoading.value ||
    !canCommit.value ||
    gitCommit.isPending.value,
);

const selectionActions = computed(() =>
  gitActionsForSelection(selectedPaths.value, changedFiles.value),
);

const hasSelection = computed(() => selectedPaths.value.length > 0);

const showSelectAllInHeader = computed(
  () => Boolean(worktree.value?.isLinked),
);

const selectablePaths = computed(() =>
  selectablePathsFromDiffItems(diffItems.value),
);

const selectAllCheckboxValue = computed(() => {
  const state = selectAllPathsState(selectedPaths.value, selectablePaths.value);
  if (state === "all") return true;
  if (state === "some") return "indeterminate";
  return false;
});

function onSelectAllChange(value: boolean | "indeterminate") {
  if (value === "indeterminate") return;
  selectedPaths.value = value
    ? [...new Set([...selectedPaths.value, ...selectablePaths.value])]
    : selectedPaths.value.filter(
        (path) => !selectablePaths.value.includes(path),
      );
}

watch(diffItems, (items) => {
  const visible = new Set(items.map((item) => item.id));
  const next = selectedPaths.value.filter((path) => visible.has(path));
  if (next.length !== selectedPaths.value.length) {
    selectedPaths.value = next;
  }
});

watch(activeTab, () => {
  selectedPaths.value = [];
});

async function runGitAction(action: GitFileAction) {
  if (!selectedPaths.value.length || gitFileActions.isPending.value) return;
  await gitFileActions.mutateAsync({
    action,
    paths: [...selectedPaths.value],
  });
  selectedPaths.value = [];
  if (action === "stage") {
    activeTab.value = "staged";
  } else if (action === "unstage") {
    activeTab.value = "unstaged";
  }
}

async function submitCommit() {
  const message = commitMessage.value.trim();
  if (!message || !canCommit.value || gitCommit.isPending.value) return;
  await gitCommit.mutateAsync({ message });
  commitMessage.value = "";
  commitOpen.value = false;
}
</script>

<template>
  <div class="flex min-h-0 h-full flex-col bg-background">
    <PanelLoading v-if="worktreeLoading" />

    <template v-else-if="worktree">
      <div
        v-if="isGitRepo === false"
        class="flex flex-col items-center justify-center gap-2 p-4 text-center text-sm text-muted-foreground"
      >
        <IsoAppsOutage class="size-20 text-muted-foreground" />
        Git is not available for this folder.
      </div>

      <PanelLoading v-else-if="isGitRepo === undefined" />

      <Tabs
        v-else-if="isGitRepo === true"
        v-model="activeTab"
        class="flex min-h-0 flex-1 flex-col gap-0"
      >
        <header
          class="box-border flex min-h-8 shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-b border-border/60 px-3"
        >
          <label
            v-if="showSelectAllInHeader"
            class="relative z-20 flex shrink-0 items-center ps-1"
            :class="diffItems.length ? 'cursor-pointer' : 'cursor-not-allowed'"
          >
            <Checkbox
              :model-value="selectAllCheckboxValue"
              :disabled="!diffItems.length"
              aria-label="Select all files in this tab"
              @update:model-value="onSelectAllChange"
              @click.stop
            />
          </label>
          <div
            v-if="worktree.isLinked"
            class="flex shrink-0 items-center gap-2 text-sm font-medium"
          >
            <GitBranchIcon class="size-4 opacity-70" />
            <span class="max-w-[12rem] truncate">{{ displayBranch }}</span>
          </div>

          <div
            v-if="!worktree.isLinked"
            class="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400"
          >
            <IsoErrorMed class="size-20 text-muted-foreground" />
            Worktree path is not available on this machine.
          </div>

          <div v-else class="flex min-w-0 flex-wrap items-center gap-2">
            <TabsList
              variant="line"
              class="shrink-0 rounded-none h-auto p-0 border-none gap-0 z-10"
            >
              <TabsTrigger
                v-for="tab in GIT_PANEL_TAB_SCOPES"
                :key="tab"
                :value="tab"
                class="text-xs gap-1.5"
              >
                {{ tab === "staged" ? "Staged" : "Unstaged" }}
                <span
                  v-if="tabCount(tab as GitPanelTabScope)"
                  class="tabular-nums text-muted-foreground"
                  >{{ tabCount(tab as GitPanelTabScope) }}</span
                >
              </TabsTrigger>
            </TabsList>

          </div>

          <div class="ml-auto flex shrink-0 items-center gap-0.5">
            <Button
              variant="ghost"
              size="icon"
              class="size-7 text-muted-foreground hover:text-foreground"
              :class="collapseAllActive ? 'text-foreground' : ''"
              @click="toggleCollapseAll"
            >
              <ChevronsDownUpIcon v-if="collapseAllActive" class="size-3.5" />
              <ChevronsUpDownIcon v-else class="size-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              class="size-7 text-muted-foreground hover:text-foreground"
              :class="diffStyle === 'split' ? 'text-foreground' : ''"
              @click="diffStyle = diffStyle === 'split' ? 'unified' : 'split'"
            >
              <Columns2Icon v-if="diffStyle === 'unified'" class="size-3.5" />
              <AlignJustifyIcon v-else class="size-3.5" />
            </Button>
            <Popover>
              <PopoverTrigger as-child>
                <Button
                  variant="ghost"
                  size="icon"
                  class="size-7 text-muted-foreground hover:text-foreground"
                >
                  <Settings2Icon class="size-3.5" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" class="w-56 p-3 text-sm">
                <div class="flex flex-col gap-3">
                  <div class="flex items-center justify-between">
                    <Label class="font-normal">Backgrounds</Label>
                    <Switch v-model:checked="showBackgrounds" />
                  </div>
                  <div class="flex items-center justify-between">
                    <Label class="font-normal">Line numbers</Label>
                    <Switch v-model:checked="showLineNumbers" />
                  </div>
                  <div class="flex items-center justify-between">
                    <Label class="font-normal">Word wrap</Label>
                    <Switch v-model:checked="wordWrap" />
                  </div>
                  <div class="flex items-center justify-between gap-2">
                    <Label class="font-normal">Indicator style</Label>
                    <Tabs v-model="diffIndicators">
                      <TabsList class="w-full">
                        <TabsTrigger value="classic" class="flex-1">
                          <AlignLeftIcon class="size-3.5" />
                        </TabsTrigger>
                        <TabsTrigger value="bars" class="flex-1">
                          <SquareIcon class="size-3.5" />
                        </TabsTrigger>
                        <TabsTrigger value="none" class="flex-1">
                          <SlashIcon class="size-3.5" />
                        </TabsTrigger>
                      </TabsList>
                    </Tabs>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
            <DropdownMenu v-if="worktree.isLinked">
              <DropdownMenuTrigger as-child>
                <Button
                  variant="outline"
                  size="sm"
                  class="h-7 gap-1 px-2 text-xs"
                  :disabled="!hasSelection || gitFileActions.isPending.value"
                >
                  <ListChecksIcon class="size-3.5 opacity-70" />
                  <span v-if="hasSelection">{{ selectedPaths.length }} selected</span>
                  <span v-else>Actions</span>
                  <ChevronDownIcon class="size-3 opacity-70" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" class="w-48">
                <DropdownMenuItem
                  :disabled="
                    !selectionActions.stage || gitFileActions.isPending.value
                  "
                  @select="runGitAction('stage')"
                >
                  <PlusIcon />
                  Stage changes
                </DropdownMenuItem>
                <DropdownMenuItem
                  :disabled="
                    !selectionActions.unstage || gitFileActions.isPending.value
                  "
                  @select="runGitAction('unstage')"
                >
                  <MinusIcon />
                  Unstage changes
                </DropdownMenuItem>
                <DropdownMenuItem
                  variant="destructive"
                  :disabled="
                    !selectionActions.discard || gitFileActions.isPending.value
                  "
                  @select="runGitAction('discard')"
                >
                  <Trash2Icon />
                  Discard changes
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Popover v-if="worktree.isLinked && activeTab === 'staged'" v-model:open="commitOpen">
              <PopoverTrigger as-child>
                <Button variant="default" size="xs" :disabled="commitDisabled">
                  Commit
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" class="w-80 p-3">
                <form
                  class="flex flex-col gap-2"
                  @submit.prevent="submitCommit"
                >
                  <Label for="git-commit-message" class="text-xs font-medium">
                    Commit message
                  </Label>
                  <Textarea
                    data-native-keyboard
                    id="git-commit-message"
                    v-model="commitMessage"
                    placeholder="Describe your changes"
                    class="min-h-20 text-sm"
                    :disabled="gitCommit.isPending.value"
                  />
                  <Button
                    type="submit"
                    size="sm"
                    class="self-end"
                    :disabled="
                      !commitMessage.trim() ||
                      gitCommit.isPending.value ||
                      !canCommit
                    "
                  >
                    Submit
                  </Button>
                </form>
              </PopoverContent>
            </Popover>
          </div>
        </header>

        <template v-if="worktree.isLinked">
          <PanelLoading v-if="statusLoading" />
          <p
            v-else-if="statusError"
            class="flex-1 px-3 py-2 text-xs text-destructive"
          >
            {{ statusErrorObj?.message ?? "Failed to load git status" }}
          </p>

          <template v-else>
            <TabsContent
              v-for="tab in GIT_PANEL_TAB_SCOPES"
              :key="tab"
              :value="tab"
              class="flex min-h-0 flex-1 flex-col mt-0 overflow-hidden"              
            >
              <PanelLoading v-if="isDiffPending(tab as GitPanelTabScope)" />
              <div
                v-else-if="!diffItemsByTab[tab as GitPanelTabScope].length"
                class="p-2 flex flex-1"
              >
                <div
                  class="flex flex-1 flex-col items-center justify-center gap-2 rounded-md border border-dashed text-xs text-muted-foreground"
                >
                  <IsoCheckCircle class="size-20 text-muted-foreground" />
                  {{
                    changedFiles.length
                      ? "No diff for this filter"
                      : "Working tree clean"
                  }}
                </div>
              </div>
              <GitDiffCodeView
                v-else
                :key="`${worktreeId}-${tab}`"
                :tab-active="activeTab === tab"
                :items="diffItemsByTab[tab as GitPanelTabScope]"
                :worktree-id="worktreeId"
                :worktree-path="worktree.path"
                :collapsed-ids="collapsedIdsForTab(tab as GitPanelTabScope)"
                :disable-background="!showBackgrounds"
                :disable-line-numbers="!showLineNumbers"
                :word-wrap="wordWrap"
                :diff-indicators="diffIndicators"
                :diff-style="diffStyle"
                :all-collapsed="allCollapsed"
                v-model:selected-paths="selectedPaths"
                @update:collapsed-ids="
                  setCollapsedIdsForTab(tab as GitPanelTabScope, $event)
                "
                @expand-one="onExpandOneDiff"
              />
            </TabsContent>
          </template>
        </template>
      </Tabs>
    </template>
  </div>
</template>
