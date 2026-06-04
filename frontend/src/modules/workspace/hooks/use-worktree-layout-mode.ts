import { computed, watch, type MaybeRefOrGetter, toValue } from "vue";
import { useQuery } from "@tanstack/vue-query";
import { useFileExplorerStorage } from "@/modules/file-explorer/lib/file-explorer-storage";
import { useGitPanelStorage } from "@/modules/git/lib/git-panel-storage";
import {
  buildWorkspaceQuery,
  migrateWorktreeLayoutToProject,
  type LayoutMode,
  type WorkspaceRouteQuery,
  useProjectLayoutPrefs,
  useWorktreePanels,
} from "@/modules/workspace/lib/worktree-panels-storage";
import { worktreeQueryOptions } from "@/modules/workspace/queries";

export type SplitAuxPanel = "git" | "explorer" | null;

export function nextLayoutMode(mode: LayoutMode): LayoutMode {
  return mode === "split" ? "page" : "split";
}

export function splitAuxPanelFromState(state: {
  git: boolean;
  explorer: boolean;
}): SplitAuxPanel {
  if (state.git) return "git";
  if (state.explorer) return "explorer";
  return null;
}

export function useWorktreeLayoutMode(worktreeId: MaybeRefOrGetter<string>) {
  const resolvedWorktreeId = computed(() => toValue(worktreeId));
  const { data: worktree } = useQuery(worktreeQueryOptions(resolvedWorktreeId));
  const panelsState = useWorktreePanels(resolvedWorktreeId);
  const gitPanelState = useGitPanelStorage(resolvedWorktreeId);
  const explorerState = useFileExplorerStorage(resolvedWorktreeId);
  const projectId = computed(
    () => worktree.value?.projectId ?? resolvedWorktreeId.value,
  );
  const layoutPrefs = useProjectLayoutPrefs(projectId);

  watch(
    [worktree, panelsState],
    ([currentWorktree, currentPanels]) => {
      if (!currentWorktree) return;
      const migrated = migrateWorktreeLayoutToProject(
        currentPanels,
        layoutPrefs.value,
      );
      if (migrated) {
        layoutPrefs.value = migrated;
      }
    },
    { immediate: true },
  );

  const layoutMode = computed<LayoutMode>({
    get: () => layoutPrefs.value.layoutMode ?? "page",
    set: (mode) => {
      layoutPrefs.value = { ...layoutPrefs.value, layoutMode: mode };
    },
  });

  const splitAuxPanel = computed(() =>
    splitAuxPanelFromState(panelsState.value),
  );

  const activeTerminalId = computed(
    () => panelsState.value.lastTerminalId ?? "",
  );

  function toggleLayoutMode() {
    layoutMode.value = nextLayoutMode(layoutMode.value);
  }

  function workspaceQuery(): WorkspaceRouteQuery {
    return buildWorkspaceQuery(
      worktree.value?.path,
      gitPanelState.value,
      explorerState.value,
    );
  }

  return {
    layoutMode,
    layoutPrefs,
    splitAuxPanel,
    activeTerminalId,
    toggleLayoutMode,
    workspaceQuery,
  };
}
