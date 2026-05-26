import { describe, expect, it } from "vitest";
import { formatQueueAppend } from "./format-queue-append";

describe("formatQueueAppend", () => {
  it("formats path only", () => {
    expect(formatQueueAppend({ relativePath: "src/a.ts" })).toBe("# src/a.ts\n\n");
  });

  it("formats path and selection", () => {
    expect(
      formatQueueAppend({ relativePath: "src/a.ts", selection: "const x = 1;" }),
    ).toBe("# src/a.ts\nconst x = 1;\n\n");
  });

  it("trims selection", () => {
    expect(
      formatQueueAppend({ relativePath: "a.ts", selection: "  hi  " }),
    ).toBe("# a.ts\nhi\n\n");
  });
});
