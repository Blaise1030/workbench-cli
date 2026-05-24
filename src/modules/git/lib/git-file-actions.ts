import type { GitStatusEntry } from "@/modules/git/queries/types";

export type GitFileAction = "stage" | "unstage" | "discard";

export function gitActionsForSelection(
  selectedPaths: string[],
  files: GitStatusEntry[],
): Record<GitFileAction, boolean> {
  const selected = new Set(selectedPaths);
  const entries = files.filter((file) => selected.has(file.path));

  return {
    stage: entries.some((file) => file.unstaged != null),
    unstage: entries.some((file) => file.staged != null),
    discard: entries.some((file) => file.unstaged != null),
  };
}
