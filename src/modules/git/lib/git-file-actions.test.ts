import { describe, expect, it } from "vitest";
import { gitActionsForSelection } from "./git-file-actions";

describe("gitActionsForSelection", () => {
  it("enables actions based on selected file status", () => {
    const files = [
      { path: "a.ts", staged: "modified", unstaged: null },
      { path: "b.ts", staged: null, unstaged: "modified" },
    ];

    expect(gitActionsForSelection(["a.ts"], files)).toEqual({
      stage: false,
      unstage: true,
      discard: false,
    });
    expect(gitActionsForSelection(["b.ts"], files)).toEqual({
      stage: true,
      unstage: false,
      discard: true,
    });
    expect(gitActionsForSelection(["a.ts", "b.ts"], files)).toEqual({
      stage: true,
      unstage: true,
      discard: true,
    });
  });
});
