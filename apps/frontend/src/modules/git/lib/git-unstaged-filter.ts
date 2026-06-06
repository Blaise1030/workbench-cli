import type { CodeViewItem } from "@pierre/diffs";
import type { GitStatusEntry } from "@/modules/git/queries/types";

/** True when `filePath` is an untracked path or lives under an untracked directory. */
export function isUntrackedPath(
  filePath: string,
  statusFiles: GitStatusEntry[],
): boolean {
  for (const entry of statusFiles) {
    if (entry.unstaged !== "untracked") continue;
    const root = entry.path;
    if (filePath === root) return true;
    const prefix = root.endsWith("/") ? root : `${root}/`;
    if (filePath.startsWith(prefix)) return true;
  }
  return false;
}

/** Drop untracked files from unstaged diff items (status is source of truth). */
export function excludeUntrackedDiffItems(
  items: CodeViewItem[],
  statusFiles: GitStatusEntry[],
): CodeViewItem[] {
  if (!statusFiles.length) return items;
  return items.filter((item) => !isUntrackedPath(item.id, statusFiles));
}
