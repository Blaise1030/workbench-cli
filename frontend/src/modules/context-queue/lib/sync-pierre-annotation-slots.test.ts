import { describe, expect, it } from "vitest";
import { annotationSlotSignature } from "./sync-pierre-annotation-slots";
import type { StoredContextQueueAnnotation } from "./context-queue-annotations-state";

const annotation: StoredContextQueueAnnotation = {
  lineNumber: 4,
  metadata: {
    id: "ann-1",
    itemId: "file.ts",
    relativePath: "file.ts",
    range: { start: 4, end: 4 },
    selection: "hello",
    note: "draft",
    includeSnippet: false,
    diff: false,
    expanded: true,
  },
};

describe("annotationSlotSignature", () => {
  it("changes when expanded state changes", () => {
    const collapsed = annotationSlotSignature({
      ...annotation,
      metadata: { ...annotation.metadata!, expanded: false },
    });
    const expanded = annotationSlotSignature(annotation);
    expect(collapsed).not.toBe(expanded);
  });

  it("changes when note changes", () => {
    const a = annotationSlotSignature(annotation);
    const b = annotationSlotSignature({
      ...annotation,
      metadata: { ...annotation.metadata!, note: "other" },
    });
    expect(a).not.toBe(b);
  });

  it("is stable for the same annotation", () => {
    expect(annotationSlotSignature(annotation)).toBe(
      annotationSlotSignature(annotation),
    );
  });
});
