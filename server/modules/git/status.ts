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

function mapStatusChar(char: string): GitFileStatusCode | null {
  switch (char) {
    case " ":
      return null;
    case "?":
      return "untracked";
    case "!":
      return "ignored";
    case "A":
      return "added";
    case "M":
      return "modified";
    case "D":
      return "deleted";
    case "R":
      return "renamed";
    case "C":
      return "copied";
    case "U":
      return "unmerged";
    default:
      return "unknown";
  }
}

/** Parse `git status --porcelain` output into structured entries. */
export function parseGitStatusPorcelain(output: string): GitStatusEntry[] {
  const entries: GitStatusEntry[] = [];
  for (const line of output.split("\n")) {
    if (!line.trim()) continue;
    const indexStatus = line[0] ?? " ";
    const worktreeStatus = line[1] ?? " ";
    let pathPart = line.slice(3);

    let previousPath: string | undefined;
    const renameArrow = " -> ";
    if (pathPart.includes(renameArrow)) {
      const [from, to] = pathPart.split(renameArrow);
      previousPath = from?.trim();
      pathPart = to?.trim() ?? pathPart;
    }

    const path = pathPart.trim();
    if (!path) continue;

    const staged = mapStatusChar(indexStatus);
    const unstaged = mapStatusChar(worktreeStatus);
    const status = staged ?? unstaged;
    if (!status) continue;

    entries.push({
      path,
      previousPath,
      staged,
      unstaged,
    });
  }
  return entries;
}
