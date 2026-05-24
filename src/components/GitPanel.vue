<script setup lang="ts">
import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import { GitBranchIcon, Settings2Icon, Columns2Icon, AlignJustifyIcon, ChevronsDownUpIcon, ChevronsUpDownIcon, AlignLeftIcon, SquareIcon, SlashIcon } from "@lucide/vue";
import {
  gitDiffQueryOptions,
  gitStatusQueryOptions,
  type GitDiffScope,
  worktreeQueryOptions,
} from "@/api/workspace";
import GitDiffCodeView from "@/components/GitDiffCodeView.vue";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { patchToCodeViewItems } from "@/lib/git-diff-items";
import { useQuery } from "@tanstack/vue-query";
import type { DiffIndicators } from "@pierre/diffs";

const props = defineProps<{
  worktreeId: string;
}>();

type TabScope = "staged" | "unstaged" | "untracked";

const route = useRoute();
const router = useRouter();

const activeTab = computed<TabScope>({
  get: () => (route.query.tab as TabScope) ?? "staged",
  set: (val: TabScope) => {
    router.replace({ query: { tab: val } });
  },
});

const showBackgrounds = ref(true);
const showLineNumbers = ref(true);
const wordWrap = ref(false);
const diffIndicators = ref<DiffIndicators>("classic");
const diffStyle = ref<"unified" | "split">("unified");
const allCollapsed = ref(false);

const apiScope = computed<GitDiffScope>(() =>
  activeTab.value === "staged" ? "staged" : "unstaged",
);

const { data: worktree, isLoading: worktreeLoading } = useQuery(
  worktreeQueryOptions(() => props.worktreeId),
);

const gitEnabled = computed(
  () => Boolean(worktree.value?.isLinked) && !worktreeLoading.value,
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

const { data: gitDiff, isLoading: diffLoading } = useQuery({
  ...gitDiffQueryOptions(
    () => props.worktreeId,
    () => apiScope.value,
    () => null,
  ),
  enabled: gitEnabled,
});

const changedFiles = computed(() => gitStatus.value?.files ?? []);

const diffItems = computed(() => {
  const patch = gitDiff.value?.patch ?? "";
  const allItems = patchToCodeViewItems(
    patch,
    `${props.worktreeId}-${activeTab.value}`,
  );

  if (activeTab.value === "untracked") {
    const untrackedPaths = new Set(
      changedFiles.value
        .filter((f) => f.unstaged === "untracked")
        .map((f) => f.path),
    );
    return allItems.filter((item) =>
      "filePath" in item ? untrackedPaths.has(item.filePath as string) : true,
    );
  }

  return allItems;
});

const displayBranch = computed(
  () => gitStatus.value?.branch ?? worktree.value?.branch ?? "detached",
);

const unstagedCount = computed(
  () => changedFiles.value.filter((f) => f.unstaged && f.unstaged !== "untracked").length,
);
const stagedCount = computed(
  () => changedFiles.value.filter((f) => f.staged).length,
);
const untrackedCount = computed(
  () => changedFiles.value.filter((f) => f.unstaged === "untracked").length,
);
</script>

<template>
  <div class="flex h-full min-h-0 flex-col bg-background">
    <div v-if="worktreeLoading" class="p-4 text-sm text-muted-foreground">
      Loading…
    </div>

    <template v-else-if="worktree">
      <Tabs v-model="activeTab" class="flex min-h-0 flex-1 flex-col gap-0">
        <header class="shrink-0 flex items-center gap-3 border-b border-border/60 px-3">
          <div class="flex items-center gap-2 text-sm font-medium shrink-0">
            <GitBranchIcon class="size-4 opacity-70" />
            <span>{{ displayBranch }}</span>
          </div>

          <div v-if="!worktree.isLinked" class="text-xs text-amber-600 dark:text-amber-400">
            Worktree path is not available on this machine.
          </div>

          <TabsList v-else variant="line" class="shrink-0 rounded-none h-auto p-0 border-none gap-0 z-10">
            <TabsTrigger value="unstaged" class="text-xs gap-1.5">
              Unstaged
              <span v-if="unstagedCount" class="tabular-nums text-muted-foreground">{{ unstagedCount }}</span>
            </TabsTrigger>
            <TabsTrigger value="staged" class="text-xs gap-1.5">
              Staged
              <span v-if="stagedCount" class="tabular-nums text-muted-foreground">{{ stagedCount }}</span>
            </TabsTrigger>
            <TabsTrigger value="untracked" class="text-xs gap-1.5">
              Untracked
              <span v-if="untrackedCount" class="tabular-nums text-muted-foreground">{{ untrackedCount }}</span>
            </TabsTrigger>
          </TabsList>

          <div class="ml-auto flex items-center gap-0.5">
            <Button
              variant="ghost"
              size="icon"
              class="size-7 text-muted-foreground hover:text-foreground"
              :class="allCollapsed ? 'text-foreground' : ''"
              @click="allCollapsed = !allCollapsed"
            >
              <ChevronsDownUpIcon v-if="allCollapsed" class="size-3.5" />
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
                <Button variant="ghost" size="icon" class="size-7 text-muted-foreground hover:text-foreground">
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
          </div>
        </header>

        <template v-if="worktree.isLinked">
          <div v-if="statusLoading" class="flex-1 px-3 py-2 text-xs text-muted-foreground">
            Loading changes…
          </div>
          <p v-else-if="statusError" class="flex-1 px-3 py-2 text-xs text-destructive">
            {{ statusErrorObj?.message ?? "Failed to load git status" }}
          </p>

          <template v-else>
            <TabsContent
              v-for="tab in ['unstaged', 'staged', 'untracked']"
              :key="tab"
              :value="tab"
              class="flex min-h-0 flex-1 flex-col mt-0 overflow-hidden"
            >
              <div
                v-if="diffLoading"
                class="flex flex-1 items-center justify-center text-xs text-muted-foreground"
              >
                Loading diff…
              </div>
              <div
                v-else-if="!diffItems.length"
                class="flex flex-1 items-center justify-center rounded-md border border-dashed border-border/60 text-xs text-muted-foreground"
              >
                {{ changedFiles.length ? "No diff for this filter" : "Working tree clean" }}
              </div>
              <GitDiffCodeView
                v-else
                :items="diffItems"
                :disable-background="!showBackgrounds"
                :disable-line-numbers="!showLineNumbers"
                :word-wrap="wordWrap"
                :diff-indicators="diffIndicators"
                :diff-style="diffStyle"
                :all-collapsed="allCollapsed"
              />
            </TabsContent>
          </template>
        </template>
      </Tabs>
    </template>
  </div>
</template>
