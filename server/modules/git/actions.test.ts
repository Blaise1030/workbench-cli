import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { applyGitFileAction, pathsForAction } from "./actions.js";
import { parseGitStatusPorcelain } from "./status.js";
import { runGit } from "./exec.js";

function initRepo(dir: string) {
  execFileSync("git", ["init"], { cwd: dir });
  execFileSync("git", ["config", "user.email", "test@example.com"], { cwd: dir });
  execFileSync("git", ["config", "user.name", "Test"], { cwd: dir });
  writeFileSync(join(dir, "tracked.txt"), "hello\n");
  execFileSync("git", ["add", "tracked.txt"], { cwd: dir });
  execFileSync("git", ["commit", "-m", "init"], { cwd: dir });
}

function statusEntries(dir: string) {
  const raw = runGit(dir, ["status", "--porcelain"], { trim: false });
  return parseGitStatusPorcelain(raw);
}

describe("applyGitFileAction", () => {
  it("stages modified files", () => {
    const dir = mkdtempSync(join(tmpdir(), "git-actions-"));
    initRepo(dir);
    writeFileSync(join(dir, "tracked.txt"), "changed\n");

    applyGitFileAction(dir, "stage", ["tracked.txt"]);
    const entries = statusEntries(dir);
    expect(entries.find((e) => e.path === "tracked.txt")?.staged).toBe("modified");
    expect(entries.find((e) => e.path === "tracked.txt")?.unstaged).toBeNull();
  });

  it("unstages staged files", () => {
    const dir = mkdtempSync(join(tmpdir(), "git-actions-"));
    initRepo(dir);
    writeFileSync(join(dir, "tracked.txt"), "changed\n");
    execFileSync("git", ["add", "tracked.txt"], { cwd: dir });

    applyGitFileAction(dir, "unstage", ["tracked.txt"]);
    const entries = statusEntries(dir);
    expect(entries.find((e) => e.path === "tracked.txt")?.staged).toBeNull();
    expect(entries.find((e) => e.path === "tracked.txt")?.unstaged).toBe("modified");
  });

  it("discards worktree changes and removes untracked files", () => {
    const dir = mkdtempSync(join(tmpdir(), "git-actions-"));
    initRepo(dir);
    writeFileSync(join(dir, "tracked.txt"), "changed\n");
    writeFileSync(join(dir, "new.txt"), "new\n");

    applyGitFileAction(dir, "discard", ["tracked.txt", "new.txt"]);
    expect(runGit(dir, ["show", "HEAD:tracked.txt"])).toBe("hello");
    expect(existsSync(join(dir, "new.txt"))).toBe(false);
  });

  it("pathsForAction filters to applicable paths", () => {
    const dir = mkdtempSync(join(tmpdir(), "git-actions-"));
    initRepo(dir);
    writeFileSync(join(dir, "tracked.txt"), "changed\n");
    const entries = statusEntries(dir);

    expect(pathsForAction("stage", ["tracked.txt", "missing.txt"], entries)).toEqual([
      "tracked.txt",
    ]);
    expect(pathsForAction("unstage", ["tracked.txt"], entries)).toEqual([]);
  });
});
