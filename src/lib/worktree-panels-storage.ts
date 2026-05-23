import type { ClientWorkspacePanel } from "@/types/workspace-panel";

export interface WorktreeAuxPanelsState {
  git: boolean;
  explorer: boolean;
  /** Last focused tab id (terminal or aux panel). */
  activeTabId?: string | null;
}

const STORAGE_PREFIX = "lan-terminal:worktree-panels:";

export function gitPanelId(worktreeId: string): string {
  return `panel-git-${worktreeId}`;
}

export function explorerPanelId(worktreeId: string): string {
  return `panel-explorer-${worktreeId}`;
}

export function loadAuxPanels(worktreeId: string): WorktreeAuxPanelsState {
  if (typeof localStorage === "undefined") {
    return { git: false, explorer: false, activeTabId: null };
  }
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${worktreeId}`);
    if (!raw) return { git: false, explorer: false, activeTabId: null };
    const parsed = JSON.parse(raw) as Partial<WorktreeAuxPanelsState>;
    const activeTabId =
      typeof parsed.activeTabId === "string" && parsed.activeTabId.length > 0
        ? parsed.activeTabId
        : null;
    return {
      git: Boolean(parsed.git),
      explorer: Boolean(parsed.explorer),
      activeTabId,
    };
  } catch {
    return { git: false, explorer: false, activeTabId: null };
  }
}

export function saveAuxPanels(
  worktreeId: string,
  state: WorktreeAuxPanelsState,
): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(`${STORAGE_PREFIX}${worktreeId}`, JSON.stringify(state));
}

export function clientPanelsFromState(
  worktreeId: string,
  state: WorktreeAuxPanelsState,
): ClientWorkspacePanel[] {
  const panels: ClientWorkspacePanel[] = [];
  if (state.git) {
    panels.push({
      id: gitPanelId(worktreeId),
      type: "git",
      title: "Git",
    });
  }
  if (state.explorer) {
    panels.push({
      id: explorerPanelId(worktreeId),
      type: "explorer",
      title: "Files",
    });
  }
  return panels;
}

export function auxPanelsStateFromClient(
  panels: ClientWorkspacePanel[],
  activeTabId?: string | null,
): WorktreeAuxPanelsState {
  return {
    git: panels.some((p) => p.type === "git"),
    explorer: panels.some((p) => p.type === "explorer"),
    activeTabId: activeTabId ?? null,
  };
}
