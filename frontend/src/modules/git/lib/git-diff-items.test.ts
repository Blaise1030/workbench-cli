import { describe, expect, it } from "vitest";
import { hashPatchForCacheKey, patchToCodeViewItems } from "./git-diff-items";

describe("hashPatchForCacheKey", () => {
  it("returns stable hash for the same patch", () => {
    const patch = "diff --git a/foo b/foo\n";
    expect(hashPatchForCacheKey(patch)).toBe(hashPatchForCacheKey(patch));
  });

  it("returns different hashes for different patches", () => {
    const a = "diff --git a/foo b/foo\n-old\n+new\n";
    const b = "diff --git a/foo b/foo\n-old\n+newer\n";
    expect(hashPatchForCacheKey(a)).not.toBe(hashPatchForCacheKey(b));
  });
});

describe("patchToCodeViewItems", () => {
  it("assigns distinct Pierre cache keys when patch content changes", () => {
    const prefix = "wt-1-unstaged";
    const patchA =
      "diff --git a/x.txt b/x.txt\n--- a/x.txt\n+++ b/x.txt\n@@ -1 +1 @@\n-old\n+new\n";
    const patchB =
      "diff --git a/x.txt b/x.txt\n--- a/x.txt\n+++ b/x.txt\n@@ -1 +1 @@\n-old\n+newer\n";

    const keyA = patchToCodeViewItems(patchA, prefix)[0]?.fileDiff.cacheKey;
    const keyB = patchToCodeViewItems(patchB, prefix)[0]?.fileDiff.cacheKey;

    expect(keyA).toBeDefined();
    expect(keyB).toBeDefined();
    expect(keyA).not.toBe(keyB);
  });
});
