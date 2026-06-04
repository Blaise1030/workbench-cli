import { useLocalStorage } from "@vueuse/core";
import { computed, type MaybeRefOrGetter, toValue } from "vue";
import type { ClientWorkspacePanel } from "@/types/workspace-panel";
import {
  GIT_PANEL_DEFAULT_TAB,
  normalizeGitPanelTabScope,
  type GitPanelWorktreeState,
} from "@/modules/git/lib/git-panel-storage";
import { worktreeFilePath } from "@/modules/file-explorer/lib/explorer-file-route";
import type { FileExplorerWorktreeState } from "@/modules/file-explorer/lib/file-explorer-storage";

export type WorktreeLastRoute = "terminal" | "git" | "explorer";

export type LayoutMode = "page" | "split";

/** Split layout prefs shared across worktrees in a project. */
export interface ProjectLayoutPrefs {
  layoutMode?: LayoutMode;
  /** Terminal pane size (% of split row) when an aux panel is open. */
  splitTerminalSize?: number;
}

export interface WorktreeAuxPanelsState {
  git: boolean;
  explorer: boolean;
  /** @deprecated Migrated to project layout prefs; read only for legacy localStorage. */
  layoutMode?: LayoutMode;
  /** @deprecated Migrated to project layout prefs; read only for legacy localStorage. */
  splitTerminalSize?: number;
  /** Last panel route visited in this worktree. */
  lastRoute?: WorktreeLastRoute;
  /** Last terminal tab when `lastRoute` is `terminal`. */
  lastTerminalId?: string;
}

export const SPLIT_TERMINAL_DEFAULT_SIZE = 65;
export const SPLIT_TERMINAL_MIN_SIZE = 25;
export const SPLIT_TERMINAL_MAX_SIZE = 80;
export const SPLIT_AUX_MIN_SIZE = 20;

export function clampSplitTerminalSize(size: number): number {
  return Math.min(
    SPLIT_TERMINAL_MAX_SIZE,
    Math.max(SPLIT_TERMINAL_MIN_SIZE, Math.round(size)),
  );
}

export interface WorkspaceRouteQuery {
  tab?: string;
  file?: string;
}

/** Build route query for page mode from durable panel storage. */
export function buildWorkspaceQuery(
  worktreePath: string | undefined,
  gitState: GitPanelWorktreeState,
  explorerState: FileExplorerWorktreeState,
): WorkspaceRouteQuery {
  const query: WorkspaceRouteQuery = {};
  const tab =
    normalizeGitPanelTabScope(gitState.activeTab) ?? GIT_PANEL_DEFAULT_TAB;
  query.tab = tab;
  const relativePath = explorerState.lastFilePath;
  if (relativePath && worktreePath) {
    query.file = encodeURIComponent(worktreeFilePath(worktreePath, relativePath));
  }
  return query;
}

const STORAGE_PREFIX = "workbench:worktree-panels:";
const PROJECT_LAYOUT_PREFIX = "workbench:project-layout:";

export function migrateWorktreeLayoutToProject(
  worktreePanels: WorktreeAuxPanelsState,
  projectPrefs: ProjectLayoutPrefs,
): ProjectLayoutPrefs | null {
  const next: ProjectLayoutPrefs = { ...projectPrefs };
  let changed = false;
  if (next.layoutMode === undefined && worktreePanels.layoutMode !== undefined) {
    next.layoutMode = worktreePanels.layoutMode;
    changed = true;
  }
  if (
    next.splitTerminalSize === undefined &&
    worktreePanels.splitTerminalSize !== undefined
  ) {
    next.splitTerminalSize = worktreePanels.splitTerminalSize;
    changed = true;
  }
  return changed ? next : null;
}

export function useProjectLayoutPrefs(projectId: MaybeRefOrGetter<string>) {
  const key = computed(() => `${PROJECT_LAYOUT_PREFIX}${toValue(projectId)}`);
  return useLocalStorage<ProjectLayoutPrefs>(key, {});
}

export function gitPanelId(worktreeId: string): string {
  return `panel-git-${worktreeId}`;
}

export function explorerPanelId(worktreeId: string): string {
  return `panel-explorer-${worktreeId}`;
}

export function activateWorktreeAuxPanel(
  state: WorktreeAuxPanelsState,
  type: Exclude<WorktreeLastRoute, "terminal">,
): WorktreeAuxPanelsState {
  return {
    ...state,
    git: type === "git",
    explorer: type === "explorer",
    lastRoute: type,
  };
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
