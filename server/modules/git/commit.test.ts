import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { commitStagedChanges, hasStagedChanges } from "./commit.js";
import { GitError } from "./exec.js";
import { runGit } from "./exec.js";

function initRepo(dir: string) {
  execFileSync("git", ["init"], { cwd: dir });
  execFileSync("git", ["config", "user.email", "test@example.com"], { cwd: dir });
  execFileSync("git", ["config", "user.name", "Test"], { cwd: dir });
  writeFileSync(join(dir, "tracked.txt"), "hello\n");
  execFileSync("git", ["add", "tracked.txt"], { cwd: dir });
  execFileSync("git", ["commit", "-m", "init"], { cwd: dir });
}

describe("commitStagedChanges", () => {
  it("commits staged changes with a message", () => {
    const dir = mkdtempSync(join(tmpdir(), "git-commit-"));
    initRepo(dir);
    writeFileSync(join(dir, "tracked.txt"), "changed\n");
    execFileSync("git", ["add", "tracked.txt"], { cwd: dir });

    expect(hasStagedChanges(dir)).toBe(true);
    commitStagedChanges(dir, "update tracked");
    expect(hasStagedChanges(dir)).toBe(false);
    expect(runGit(dir, ["log", "-1", "--format=%s"])).toBe("update tracked");
  });

  it("rejects empty messages", () => {
    const dir = mkdtempSync(join(tmpdir(), "git-commit-"));
    initRepo(dir);
    writeFileSync(join(dir, "tracked.txt"), "changed\n");
    execFileSync("git", ["add", "tracked.txt"], { cwd: dir });

    expect(() => commitStagedChanges(dir, "   ")).toThrow(GitError);
  });

  it("rejects when nothing is staged", () => {
    const dir = mkdtempSync(join(tmpdir(), "git-commit-"));
    initRepo(dir);

    expect(hasStagedChanges(dir)).toBe(false);
    expect(() => commitStagedChanges(dir, "noop")).toThrow(GitError);
  });
});
