import {
  parsePatchFiles,
  type CodeViewItem,
} from "@pierre/diffs";

/** Turn a unified diff patch into CodeView diff items for @pierre/diffs CodeView. */
export function patchToCodeViewItems(
  patch: string,
  cacheKeyPrefix: string,
): CodeViewItem[] {
  if (!patch.trim()) return [];

  const patches = parsePatchFiles(patch, cacheKeyPrefix);
  const items: CodeViewItem[] = [];

  for (const parsed of patches) {
    for (const fileDiff of parsed.files) {
      items.push({
        id: fileDiff.name,
        type: "diff",
        fileDiff,
      });
    }
  }

  return items;
}
