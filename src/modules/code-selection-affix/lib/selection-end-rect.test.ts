import { describe, expect, it } from "vitest";
import { selectionAnchorRect } from "./selection-end-rect";

describe("selectionAnchorRect", () => {
  it("returns null when root is null", () => {
    expect(selectionAnchorRect(null)).toBeNull();
  });
});
