import { describe, it, expect } from "vitest";
import { extractFilePaths } from "./terminal-file-links";

describe("extractFilePaths", () => {
  const root = "/home/user/project";

  it("returns empty array for line with no paths", () => {
    expect(extractFilePaths("no paths here", root)).toEqual([]);
  });

  it("returns empty for paths outside the worktree root", () => {
    expect(extractFilePaths("/usr/bin/node crashed", root)).toEqual([]);
  });

  it("returns empty when worktreePath is empty string", () => {
    expect(extractFilePaths("/home/user/project/src/app.ts", "")).toEqual([]);
  });

  it("matches an absolute path directly under the worktree root", () => {
    const results = extractFilePaths("/home/user/project/src/app.ts", root);
    expect(results).toHaveLength(1);
    expect(results[0].path).toBe("/home/user/project/src/app.ts");
    expect(results[0].text).toBe("/home/user/project/src/app.ts");
    expect(results[0].startX).toBe(0);
    expect(results[0].endX).toBe("/home/user/project/src/app.ts".length);
  });

  it("strips a trailing :line suffix, preserving raw text", () => {
    const results = extractFilePaths("/home/user/project/src/app.ts:42", root);
    expect(results).toHaveLength(1);
    expect(results[0].path).toBe("/home/user/project/src/app.ts");
    expect(results[0].text).toBe("/home/user/project/src/app.ts:42");
  });

  it("strips a trailing :line:col suffix", () => {
    const results = extractFilePaths("/home/user/project/src/app.ts:42:7", root);
    expect(results).toHaveLength(1);
    expect(results[0].path).toBe("/home/user/project/src/app.ts");
    expect(results[0].text).toBe("/home/user/project/src/app.ts:42:7");
  });

  it("finds a path embedded in surrounding text and reports correct startX", () => {
    const prefix = "Error: cannot open ";
    const line = `${prefix}/home/user/project/src/app.ts:10:5: not found`;
    const results = extractFilePaths(line, root);
    expect(results).toHaveLength(1);
    expect(results[0].path).toBe("/home/user/project/src/app.ts");
    expect(results[0].startX).toBe(prefix.length);
    expect(results[0].endX).toBe(prefix.length + "/home/user/project/src/app.ts:10:5".length);
  });

  it("returns multiple paths found on the same line", () => {
    const line = "/home/user/project/a.ts and /home/user/project/b.ts";
    const results = extractFilePaths(line, root);
    expect(results).toHaveLength(2);
    expect(results[0].path).toBe("/home/user/project/a.ts");
    expect(results[1].path).toBe("/home/user/project/b.ts");
  });

  it("does not match the worktree root itself (must be a file inside it)", () => {
    expect(extractFilePaths("/home/user/project", root)).toEqual([]);
  });
});
