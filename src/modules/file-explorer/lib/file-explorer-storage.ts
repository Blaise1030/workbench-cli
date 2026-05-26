import { useLocalStorage } from "@vueuse/core";
import { computed, type MaybeRefOrGetter, toValue } from "vue";

export interface FileExplorerWorktreeState {
  /** Tree panel size as a percentage of the split (15–55). */
  treeSize?: number;
  /** Path relative to the worktree root. */
  lastFilePath?: string;
  /** Open file tabs (relative paths), in tab order. Scoped per worktree. */
  openFiles?: string[];
  /** Folder paths expanded in the file tree sidebar. */
  expandedPaths?: string[];
}

/** Ancestor directory paths for a file or folder path (not including the path itself). */
export function ancestorDirectoryPaths(relativePath: string): string[] {
  const parts = relativePath.split("/").filter(Boolean);
  if (parts.length <= 1) return [];
  const ancestors: string[] = [];
  for (let depth = 1; depth < parts.length; depth += 1) {
    ancestors.push(parts.slice(0, depth).join("/"));
  }
  return ancestors;
}

export function mergeExpandedPaths(
  stored: string[] | undefined,
  ...required: (string | null | undefined)[]
): string[] {
  const merged = new Set(stored ?? []);
  for (const path of required) {
    if (!path) continue;
    for (const ancestor of ancestorDirectoryPaths(path)) {
      merged.add(ancestor);
    }
    if (path.endsWith("/") || !path.includes(".")) {
      merged.add(path.replace(/\/$/, ""));
    }
  }
  return [...merged].sort();
}

const STORAGE_PREFIX = "lan-terminal:file-explorer:";

export const FILE_EXPLORER_DEFAULT_TREE_SIZE = 30;
export const FILE_EXPLORER_MIN_TREE_SIZE = 15;
export const FILE_EXPLORER_MAX_TREE_SIZE = 55;

export function clampFileExplorerTreeSize(size: number): number {
  return Math.min(
    FILE_EXPLORER_MAX_TREE_SIZE,
    Math.max(FILE_EXPLORER_MIN_TREE_SIZE, Math.round(size)),
  );
}

export function useFileExplorerStorage(worktreeId: MaybeRefOrGetter<string>) {
  const key = computed(() => `${STORAGE_PREFIX}${toValue(worktreeId)}`);
  return useLocalStorage<FileExplorerWorktreeState>(key, {});
}
