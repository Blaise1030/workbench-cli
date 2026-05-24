import { useLocalStorage } from "@vueuse/core";
import { computed, type MaybeRefOrGetter, toValue } from "vue";

export type GitPanelTabScope = "staged" | "unstaged";

export const GIT_PANEL_TAB_SCOPES: readonly GitPanelTabScope[] = [
  "staged",
  "unstaged",
] as const;

export function isGitPanelTabScope(value: unknown): value is GitPanelTabScope {
  return value === "staged" || value === "unstaged";
}

/** Legacy tab value from older panel versions. */
export function normalizeGitPanelTabScope(
  value: unknown,
): GitPanelTabScope | undefined {
  if (value === "untracked") return "unstaged";
  return isGitPanelTabScope(value) ? value : undefined;
}

export interface GitPanelWorktreeState {
  activeTab?: GitPanelTabScope;
  /** Per scope, file diff ids (CodeView item id) that are collapsed. */
  collapsedByTab?: Partial<Record<GitPanelTabScope, string[]>>;
}

const STORAGE_PREFIX = "lan-terminal:git-panel:";

export const GIT_PANEL_DEFAULT_TAB: GitPanelTabScope = "unstaged";

export function useGitPanelStorage(worktreeId: MaybeRefOrGetter<string>) {
  const key = computed(() => `${STORAGE_PREFIX}${toValue(worktreeId)}`);
  return useLocalStorage<GitPanelWorktreeState>(key, {});
}
