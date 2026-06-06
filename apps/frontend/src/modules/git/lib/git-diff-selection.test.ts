import { describe, expect, it } from "vitest";
import {
  selectAllPathsState,
  selectablePathsFromDiffItems,
  toggleSelectAllPaths,
} from "./git-diff-selection.js";

describe("selectablePathsFromDiffItems", () => {
  it("returns file paths from diff items", () => {
    const items = [
      {
        id: "a.ts",
        type: "diff" as const,
        fileDiff: { name: "a.ts" },
      },
      {
        id: "b.ts",
        type: "diff" as const,
        fileDiff: { name: "b.ts" },
      },
    ];

    expect(selectablePathsFromDiffItems(items)).toEqual(["a.ts", "b.ts"]);
  });

  it("skips items without a file path", () => {
    const items = [
      {
        id: "x",
        type: "diff" as const,
        fileDiff: {},
      },
    ];

    expect(selectablePathsFromDiffItems(items)).toEqual([]);
  });
});

describe("selectAllPathsState", () => {
  const selectable = ["a.ts", "b.ts"];

  it("reports none, some, and all", () => {
    expect(selectAllPathsState([], selectable)).toBe("none");
    expect(selectAllPathsState(["a.ts"], selectable)).toBe("some");
    expect(selectAllPathsState(["a.ts", "b.ts"], selectable)).toBe("all");
  });
});

describe("toggleSelectAllPaths", () => {
  const selectable = ["a.ts", "b.ts"];

  it("selects all visible paths when not fully selected", () => {
    expect(toggleSelectAllPaths([], selectable)).toEqual(["a.ts", "b.ts"]);
    expect(toggleSelectAllPaths(["a.ts"], selectable)).toEqual([
      "a.ts",
      "b.ts",
    ]);
  });

  it("clears only visible paths when all are selected", () => {
    expect(toggleSelectAllPaths(["a.ts", "b.ts", "other.ts"], selectable)).toEqual(
      ["other.ts"],
    );
  });
});
