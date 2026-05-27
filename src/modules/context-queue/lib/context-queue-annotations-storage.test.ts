import { describe, expect, it } from "vitest";
import type { StoredContextQueueAnnotation } from "./context-queue-annotations-state";

const STORAGE_PREFIX = "lan-terminal:context-queue-annotations:";

describe("context queue annotations storage shape", () => {
  it("round-trips annotation metadata via JSON", () => {
    const entry: StoredContextQueueAnnotation = {
      side: "additions",
      lineNumber: 12,
      metadata: {
        id: "a1",
        itemId: "diff-1",
        relativePath: "src/foo.ts",
        range: { start: 10, end: 12, side: "additions", endSide: "additions" },
        selection: "const x = 1",
        note: "Fix here",
        includeSnippet: false,
        diff: true,
        queued: true,
        expanded: false,
      },
    };
    const parsed = JSON.parse(
      JSON.stringify(entry),
    ) as StoredContextQueueAnnotation;
    expect(parsed.metadata?.note).toBe("Fix here");
    expect(parsed.lineNumber).toBe(12);
  });

  it("uses per-worktree storage key prefix", () => {
    expect(`${STORAGE_PREFIX}wt-abc`).toBe(
      "lan-terminal:context-queue-annotations:wt-abc",
    );
  });
});
