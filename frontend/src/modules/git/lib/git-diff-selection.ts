import type { CodeViewItem } from "@pierre/diffs";

export type SelectAllState = "none" | "some" | "all";

/** Paths that can be toggled in the diff list for the current tab. */
export function selectablePathsFromDiffItems(
  items: readonly CodeViewItem[],
): string[] {
  const paths: string[] = [];
  for (const item of items) {
    if (item.type !== "diff") continue;
    const path = item.fileDiff?.name;
    if (path) paths.push(path);
  }
  return paths;
}

export function selectAllPathsState(
  selectedPaths: readonly string[],
  selectablePaths: readonly string[],
): SelectAllState {
  if (!selectablePaths.length) return "none";
  const selected = new Set(selectedPaths);
  let count = 0;
  for (const path of selectablePaths) {
    if (selected.has(path)) count += 1;
  }
  if (count === 0) return "none";
  if (count === selectablePaths.length) return "all";
  return "some";
}

/** Select every visible path, or clear only paths from the current tab. */
export function toggleSelectAllPaths(
  selectedPaths: readonly string[],
  selectablePaths: readonly string[],
): string[] {
  const state = selectAllPathsState(selectedPaths, selectablePaths);
  if (state === "all") {
    const visible = new Set(selectablePaths);
    return selectedPaths.filter((path) => !visible.has(path));
  }
  return [...new Set([...selectedPaths, ...selectablePaths])];
}
