import {
  parsePatchFiles,
  type CodeViewItem,
} from "@pierre/diffs";

/** FNV-1a 32-bit — cheap stable hash so Pierre cache keys change when the patch changes. */
export function hashPatchForCacheKey(patch: string): string {
  if (!patch) return "empty";
  let h = 2166136261;
  for (let i = 0; i < patch.length; i++) {
    h ^= patch.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

/** Turn a unified diff patch into CodeView diff items for @pierre/diffs CodeView. */
export function patchToCodeViewItems(
  patch: string,
  cacheKeyPrefix: string,
): CodeViewItem[] {
  if (!patch.trim()) return [];

  // Pierre treats equal cacheKey as the same diff (areDiffTargetsEqual). Include patch
  // content in the prefix so poll/refetch does not reuse stale highlight AST.
  const patches = parsePatchFiles(
    patch,
    `${cacheKeyPrefix}-${hashPatchForCacheKey(patch)}`,
  );
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
