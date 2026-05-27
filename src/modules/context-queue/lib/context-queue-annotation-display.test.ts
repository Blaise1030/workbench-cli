import { describe, expect, it } from "vitest";
import { isAnnotationExpanded } from "./context-queue-annotation-display";
import type { ContextQueueAnnotationMeta } from "./context-queue-annotation-types";

const base: ContextQueueAnnotationMeta = {
  id: "1",
  itemId: "f",
  relativePath: "a.ts",
  range: { start: 1, end: 1 },
  selection: "code",
  note: "",
  includeSnippet: false,
  diff: false,
};

describe("isAnnotationExpanded", () => {
  it("defaults to expanded when flag is omitted", () => {
    expect(isAnnotationExpanded(base)).toBe(true);
  });

  it("is expanded when expanded is true", () => {
    expect(isAnnotationExpanded({ ...base, expanded: true })).toBe(true);
  });

  it("is collapsed when expanded is false", () => {
    expect(isAnnotationExpanded({ ...base, expanded: false })).toBe(false);
  });
});
