export type GitFileStatusCode =
  | "added"
  | "modified"
  | "deleted"
  | "renamed"
  | "copied"
  | "untracked"
  | "unmerged"
  | "ignored"
  | "unknown";

export interface GitStatusEntry {
  path: string;
  previousPath?: string;
  staged: GitFileStatusCode | null;
  unstaged: GitFileStatusCode | null;
}

export type GitDiffScope = "all" | "staged" | "unstaged";
