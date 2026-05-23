<script setup lang="ts">
import { computed, ref } from "vue";
import { GitBranchIcon } from "@lucide/vue";
import {
  gitDiffQueryOptions,
  gitStatusQueryOptions,
  type GitDiffScope,
  type GitFileStatusCode,
  type GitStatusEntry,
  worktreeQueryOptions,
} from "@/api/workspace";
import GitDiffCodeView from "@/components/GitDiffCodeView.vue";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { patchToCodeViewItems } from "@/lib/git-diff-items";
import { useQuery } from "@tanstack/vue-query";

const props = defineProps<{
  worktreeId: string;
}>();

const scope = ref<GitDiffScope>("all");
const selectedPath = ref<string | null>(null);

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
    () => scope.value,
    () => selectedPath.value,
  ),
  enabled: gitEnabled,
});

const diffItems = computed(() => {
  const patch = gitDiff.value?.patch ?? "";
  return patchToCodeViewItems(
    patch,
    `${props.worktreeId}-${scope.value}-${selectedPath.value ?? "all"}`,
  );
});

const changedFiles = computed(() => gitStatus.value?.files ?? []);

const displayBranch = computed(
  () => gitStatus.value?.branch ?? worktree.value?.branch ?? "detached",
);

function statusLabel(entry: GitStatusEntry): string {
  const codes = [entry.staged, entry.unstaged].filter(Boolean) as GitFileStatusCode[];
  const unique = [...new Set(codes)];
  return unique.map(formatStatusCode).join(" · ") || "changed";
}

function formatStatusCode(code: GitFileStatusCode): string {
  switch (code) {
    case "added":
      return "added";
    case "modified":
      return "modified";
    case "deleted":
      return "deleted";
    case "renamed":
      return "renamed";
    case "copied":
      return "copied";
    case "untracked":
      return "untracked";
    case "unmerged":
      return "unmerged";
    default:
      return code;
  }
}

function statusColor(entry: GitStatusEntry): string {
  const code = entry.staged ?? entry.unstaged;
  switch (code) {
    case "added":
    case "untracked":
      return "text-emerald-600 dark:text-emerald-400";
    case "deleted":
      return "text-red-600 dark:text-red-400";
    case "modified":
    case "renamed":
      return "text-amber-600 dark:text-amber-400";
    default:
      return "text-muted-foreground";
  }
}

function selectFile(path: string) {
  selectedPath.value = selectedPath.value === path ? null : path;
}
</script>

<template>
  <div class="flex h-full min-h-0 flex-col bg-background">
    <div v-if="worktreeLoading" class="p-4 text-sm text-muted-foreground">
      Loading…
    </div>

    <template v-else-if="worktree">
      <header class="shrink-0 space-y-3 border-b border-border/60 p-3">
        <div class="flex items-center gap-2 text-sm font-medium">
          <GitBranchIcon class="size-4 opacity-70" />
          <span>{{ displayBranch }}</span>
        </div>
        <p class="font-mono text-xs text-muted-foreground break-all">
          {{ worktree.path }}
        </p>

        <div v-if="!worktree.isLinked" class="text-xs text-amber-600 dark:text-amber-400">
          Worktree path is not available on this machine.
        </div>

        <template v-else>
          <ToggleGroup
            v-model="scope"
            type="single"
            variant="outline"
            size="sm"
            class="w-full"
          >
            <ToggleGroupItem value="all" class="flex-1 text-xs">
              All changes
            </ToggleGroupItem>
            <ToggleGroupItem value="unstaged" class="flex-1 text-xs">
              Unstaged
            </ToggleGroupItem>
            <ToggleGroupItem value="staged" class="flex-1 text-xs">
              Staged
            </ToggleGroupItem>
          </ToggleGroup>
        </template>
      </header>

      <template v-if="worktree.isLinked">
        <div
          v-if="statusLoading"
          class="shrink-0 px-3 py-2 text-xs text-muted-foreground"
        >
          Loading changes…
        </div>
        <p
          v-else-if="statusError"
          class="shrink-0 px-3 py-2 text-xs text-destructive"
        >
          {{ statusErrorObj?.message ?? "Failed to load git status" }}
        </p>

        <section
          v-else-if="changedFiles.length"
          class="shrink-0 border-b border-border/60"
        >
          <div class="flex items-center justify-between px-3 py-2">
            <h2
              class="text-xs font-medium uppercase tracking-wide text-muted-foreground"
            >
              Changed files
            </h2>
            <button
              v-if="selectedPath"
              type="button"
              class="text-xs text-muted-foreground hover:text-foreground"
              @click="selectedPath = null"
            >
              Show all
            </button>
          </div>
          <ul class="max-h-36 overflow-y-auto px-1 pb-2">
            <li v-for="file in changedFiles" :key="file.path">
              <button
                type="button"
                class="flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-muted/60"
                :class="
                  selectedPath === file.path ? 'bg-muted' : ''
                "
                @click="selectFile(file.path)"
              >
                <span
                  class="mt-0.5 w-14 shrink-0 font-medium capitalize"
                  :class="statusColor(file)"
                >
                  {{ statusLabel(file) }}
                </span>
                <span class="min-w-0 flex-1 font-mono break-all text-foreground">
                  {{ file.path }}
                </span>
              </button>
            </li>
          </ul>
        </section>

        <p
          v-else
          class="shrink-0 px-3 py-2 text-xs text-muted-foreground"
        >
          No changes
        </p>

        <div class="flex min-h-0 flex-1 flex-col p-3 pt-2">
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
            {{
              changedFiles.length
                ? "No diff for the current filter"
                : "Working tree clean"
            }}
          </div>
          <GitDiffCodeView v-else :items="diffItems" />
        </div>
      </template>
    </template>
  </div>
</template>
