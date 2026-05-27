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

  it("fences only the note after the pointer", () => {
    expect(
      formatQueueAppend({
        relativePath: "src/modules/context-queue/components/ContextQueuePopover.vue",
        lineRange: { start: 6, end: 6, side: "additions", endSide: "additions" },
        diff: true,
        note: "Test",
      }),
    ).toBe(
      "src/modules/context-queue/components/ContextQueuePopover.vue:new:6:6\n```\nTest\n```\n\n",
    );
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

  it("fences note and snippet separately when all are present", () => {
    expect(
      formatQueueAppend({
        relativePath: "server/tls.ts",
        lineRange: { start: 14, end: 14, side: "additions", endSide: "additions" },
        diff: true,
        note: "asdasdasd",
        selection: "export function parse() {}",
        includeSnippet: true,
      }),
    ).toBe(
      "server/tls.ts:new:14:14\n```\nasdasdasd\n```\n```\nexport function parse() {}\n```\n\n",
    );
  });
});
