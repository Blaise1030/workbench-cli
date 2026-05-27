import { describe, expect, it } from "vitest";
import {
  hasCommentContent,
  shouldShowEditor,
} from "./context-queue-annotation-display";
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

describe("hasCommentContent", () => {
  it("is false for empty draft", () => {
    expect(hasCommentContent(base)).toBe(false);
  });

  it("is true when note has text", () => {
    expect(hasCommentContent({ ...base, note: "fix this" })).toBe(true);
  });

  it("is true when queued", () => {
    expect(hasCommentContent({ ...base, queued: true })).toBe(true);
  });
});

describe("shouldShowEditor", () => {
  it("shows editor for new empty comment", () => {
    expect(shouldShowEditor({ ...base, expanded: true })).toBe(true);
    expect(shouldShowEditor({ ...base, expanded: false })).toBe(true);
  });

  it("shows preview when note exists and collapsed", () => {
    expect(
      shouldShowEditor({ ...base, note: "hi", expanded: false }),
    ).toBe(false);
  });

  it("shows editor when note exists and expanded", () => {
    expect(shouldShowEditor({ ...base, note: "hi", expanded: true })).toBe(
      true,
    );
  });
});
