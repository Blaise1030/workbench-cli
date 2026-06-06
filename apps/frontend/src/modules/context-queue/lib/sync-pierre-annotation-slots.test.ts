import { describe, expect, it } from "vitest";
import {
  annotationSlotSignature,
  annotationSlotsByName,
} from "./sync-pierre-annotation-slots";
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

describe("annotationSlotsByName", () => {
  it("keeps one wrapper per annotation slot and removes duplicates", () => {
    const removed: string[] = [];
    const slot = (name: string, id: string) =>
      ({
        getAttribute: (attr: string) => (attr === "slot" ? name : null),
        remove: () => removed.push(id),
      }) as HTMLElement;

    const first = slot("annotation-4", "first");
    const second = slot("annotation-4", "second");

    const slots = annotationSlotsByName([first, second]);

    expect(slots.get("annotation-4")).toBe(first);
    expect(removed).toEqual(["second"]);
  });
});
