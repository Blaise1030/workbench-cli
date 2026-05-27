import { describe, expect, it } from "vitest";
import { resolveCodeViewItem } from "./context-queue-annotation-popover";

describe("resolveCodeViewItem", () => {
  const fileItem = {
    id: "src/a.ts",
    type: "file" as const,
    file: { name: "a.ts", contents: "x", cacheKey: "k" },
  };

  it("returns the item when passed directly", () => {
    expect(resolveCodeViewItem(fileItem)).toBe(fileItem);
  });

  it("unwraps Pierre virtualized context", () => {
    expect(resolveCodeViewItem({ item: fileItem })).toBe(fileItem);
  });
});
