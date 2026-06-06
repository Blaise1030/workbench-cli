import { describe, expect, it } from "vitest";
import {
  excludeUntrackedDiffItems,
  isUntrackedPath,
} from "./git-unstaged-filter.js";
import type { GitStatusEntry } from "@/modules/git/queries/types";

const untrackedDir: GitStatusEntry = {
  path: ".claude/",
  staged: null,
  unstaged: "untracked",
};
const modified: GitStatusEntry = {
  path: "src/app.ts",
  staged: null,
  unstaged: "modified",
};

describe("isUntrackedPath", () => {
  it("matches exact path and children of untracked directories", () => {
    const files = [untrackedDir, modified];
    expect(isUntrackedPath(".claude/", files)).toBe(true);
    expect(isUntrackedPath(".claude/skills/foo.md", files)).toBe(true);
    expect(isUntrackedPath("src/app.ts", files)).toBe(false);
  });
});

describe("excludeUntrackedDiffItems", () => {
  it("removes items under untracked roots", () => {
    const items = [
      { id: ".claude/a.md", type: "diff" as const },
      { id: "src/app.ts", type: "diff" as const },
    ];
    const filtered = excludeUntrackedDiffItems(items, [untrackedDir, modified]);
    expect(filtered.map((i) => i.id)).toEqual(["src/app.ts"]);
  });
});
