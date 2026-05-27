import { useLocalStorage } from "@vueuse/core";
import { computed, type MaybeRefOrGetter, toValue } from "vue";
import type { ClientWorkspacePanel } from "@/types/workspace-panel";

export type WorktreeLastRoute = "terminal" | "git" | "explorer";

export interface WorktreeAuxPanelsState {
  git: boolean;
  explorer: boolean;
  /** Last panel route visited in this worktree. */
  lastRoute?: WorktreeLastRoute;
  /** Last terminal tab when `lastRoute` is `terminal`. */
  lastTerminalId?: string;
}

const STORAGE_PREFIX = "workbench:worktree-panels:";

export function gitPanelId(worktreeId: string): string {
  return `panel-git-${worktreeId}`;
}

export function explorerPanelId(worktreeId: string): string {
  return `panel-explorer-${worktreeId}`;
}

export function useWorktreePanels(worktreeId: MaybeRefOrGetter<string>) {
  const key = computed(() => `${STORAGE_PREFIX}${toValue(worktreeId)}`);
  return useLocalStorage<WorktreeAuxPanelsState>(key, { git: false, explorer: false });
}

export function clientPanelsFromState(
  worktreeId: string,
  state: WorktreeAuxPanelsState,
): ClientWorkspacePanel[] {
  const panels: ClientWorkspacePanel[] = [];
  if (state.git) {
    panels.push({ id: gitPanelId(worktreeId), type: "git", title: "Git" });
  }
  if (state.explorer) {
    panels.push({ id: explorerPanelId(worktreeId), type: "explorer", title: "Files" });
  }
  return panels;
}
