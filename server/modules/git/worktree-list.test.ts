import { describe, it, expect } from "vitest";
import { parseWorktreePorcelain } from "./worktree-list.js";

describe("parseWorktreePorcelain", () => {
  it("parses a single worktree block", () => {
    const out = parseWorktreePorcelain(`worktree /repo
HEAD abc123
branch refs/heads/main
`);
    expect(out).toEqual([
      {
        path: "/repo",
        head: "abc123",
        branch: "main",
        gitDir: undefined,
      },
    ]);
  });

  it("parses multiple worktrees", () => {
    const out = parseWorktreePorcelain(`worktree /repo
HEAD aaa
branch refs/heads/main

worktree /repo-feat
HEAD bbb
branch refs/heads/feat
gitdir /repo/.git/worktrees/feat
`);
    expect(out).toHaveLength(2);
    expect(out[1]?.branch).toBe("feat");
    expect(out[1]?.gitDir).toBe("/repo/.git/worktrees/feat");
  });
});
