import { describe, expect, it } from "vitest";
import { parseGitStatusPorcelain } from "./status.js";

describe("parseGitStatusPorcelain", () => {
  it("parses modified and untracked files", () => {
    const out = parseGitStatusPorcelain(` M src/a.ts
?? new.ts
`);
    expect(out).toEqual([
      {
        path: "src/a.ts",
        staged: null,
        unstaged: "modified",
      },
      {
        path: "new.ts",
        staged: "untracked",
        unstaged: "untracked",
      },
    ]);
  });

  it("parses renames", () => {
    const out = parseGitStatusPorcelain(`R  old.ts -> new.ts\n`);
    expect(out[0]).toMatchObject({
      path: "new.ts",
      previousPath: "old.ts",
      staged: "renamed",
    });
  });
});
