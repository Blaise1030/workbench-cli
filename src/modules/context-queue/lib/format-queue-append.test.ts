import { describe, expect, it } from "vitest";
import { formatQueueAppend } from "./format-queue-append";

describe("formatQueueAppend", () => {
  it("formats path only", () => {
    expect(formatQueueAppend({ relativePath: "src/a.ts" })).toBe("src/a.ts\n\n");
  });

  it("formats file as path:from:to", () => {
    expect(
      formatQueueAppend({
        relativePath: "src/a.ts",
        lineRange: { start: 12, end: 18 },
      }),
    ).toBe("src/a.ts:12:18\n\n");
  });

  it("formats diff additions as path:new:from:to", () => {
    expect(
      formatQueueAppend({
        relativePath: "src/a.ts",
        lineRange: { start: 5, end: 5, side: "additions", endSide: "additions" },
        diff: true,
      }),
    ).toBe("src/a.ts:new:5:5\n\n");
  });

  it("formats diff deletions as path:old:from:to", () => {
    expect(
      formatQueueAppend({
        relativePath: "src/a.ts",
        lineRange: { start: 3, end: 7, side: "deletions", endSide: "deletions" },
        diff: true,
      }),
    ).toBe("src/a.ts:old:3:7\n\n");
  });

  it("includes note without snippet", () => {
    expect(
      formatQueueAppend({
        relativePath: "src/a.ts",
        lineRange: { start: 1, end: 3 },
        note: "Fix the guard here",
      }),
    ).toBe("src/a.ts:1:3\nFix the guard here\n\n");
  });

  it("includes fenced snippet only when requested", () => {
    expect(
      formatQueueAppend({
        relativePath: "src/a.ts",
        lineRange: { start: 2, end: 2 },
        selection: "const x = 1;",
        includeSnippet: true,
      }),
    ).toBe("src/a.ts:2:2\n```\nconst x = 1;\n```\n\n");
  });
});
