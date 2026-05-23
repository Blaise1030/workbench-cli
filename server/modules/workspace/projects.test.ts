import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { createDatabase } from "../../db/index.js";
import { registerProject, listProjects } from "./projects.js";

function initRepo(dir: string) {
  execFileSync("git", ["init"], { cwd: dir });
  execFileSync("git", ["commit", "--allow-empty", "-m", "init"], {
    cwd: dir,
    env: { ...process.env, GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@t.com" },
  });
}

describe("registerProject", () => {
  let repoDir: string;
  let sqlite: ReturnType<typeof createDatabase>["sqlite"];
  let db: ReturnType<typeof createDatabase>["db"];

  beforeEach(() => {
    ({ db, sqlite } = createDatabase(":memory:"));
    repoDir = mkdtempSync(join(tmpdir(), "lan-term-proj-"));
    initRepo(repoDir);
  });

  afterEach(() => {
    sqlite.close();
    rmSync(repoDir, { recursive: true, force: true });
  });

  it("registers a git repo and syncs worktrees", async () => {
    const project = await registerProject(db, repoDir);
    expect(project.repoPath).toBe(repoDir);
    const all = await listProjects(db);
    expect(all).toHaveLength(1);
  });

  it("rejects non-git paths", async () => {
    const notRepo = mkdtempSync(join(tmpdir(), "lan-term-norepo-"));
    await expect(registerProject(db, notRepo)).rejects.toThrow(/not a git/i);
    rmSync(notRepo, { recursive: true, force: true });
  });
});
