import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { getWorktreeDiff, listUntrackedFilePaths } from "./diff.js";

function initRepo(dir: string) {
  execFileSync("git", ["init"], { cwd: dir });
  execFileSync("git", ["config", "user.email", "test@example.com"], { cwd: dir });
  execFileSync("git", ["config", "user.name", "Test"], { cwd: dir });
  writeFileSync(join(dir, "tracked.txt"), "hello\n");
  execFileSync("git", ["add", "tracked.txt"], { cwd: dir });
  execFileSync("git", ["commit", "-m", "init"], { cwd: dir });
}

describe("git diff", () => {
  it("lists untracked files inside directories, not directory entries", () => {
    const dir = mkdtempSync(join(tmpdir(), "git-diff-"));
    initRepo(dir);
    mkdirSync(join(dir, "public"));
    writeFileSync(join(dir, "public", "logo.png"), "png");

    const paths = listUntrackedFilePaths(dir);
    expect(paths).toEqual(["public/logo.png"]);
    expect(paths).not.toContain("public");
  });

  it("unstaged scope includes untracked file diffs without public/null errors", () => {
    const dir = mkdtempSync(join(tmpdir(), "git-diff-"));
    initRepo(dir);
    mkdirSync(join(dir, "public"));
    writeFileSync(join(dir, "public", "logo.png"), "png");

    expect(() => getWorktreeDiff(dir, "unstaged")).not.toThrow();
    const patch = getWorktreeDiff(dir, "unstaged");
    expect(patch).toContain("public/logo.png");
  });
});
