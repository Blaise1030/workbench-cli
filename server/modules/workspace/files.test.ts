import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { listFilesForWorktree, readFileForWorktree } from "./files.js";

describe("listFilesForWorktree", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "lan-term-files-"));
    mkdirSync(join(dir, "src", "components"), { recursive: true });
    mkdirSync(join(dir, "node_modules", "lodash"), { recursive: true });
    mkdirSync(join(dir, ".git"), { recursive: true });
    writeFileSync(join(dir, "src", "index.ts"), "");
    writeFileSync(join(dir, "src", "components", "Button.tsx"), "");
    writeFileSync(join(dir, "README.md"), "");
    writeFileSync(join(dir, "node_modules", "lodash", "index.js"), "");
    writeFileSync(join(dir, ".git", "config"), "");
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("returns relative posix paths for all files", async () => {
    const paths = await listFilesForWorktree(dir);
    expect(paths).toContain("README.md");
    expect(paths).toContain("src/index.ts");
    expect(paths).toContain("src/components/Button.tsx");
  });

  it("excludes node_modules", async () => {
    const paths = await listFilesForWorktree(dir);
    expect(paths.every((p) => !p.startsWith("node_modules"))).toBe(true);
  });

  it("excludes .git", async () => {
    const paths = await listFilesForWorktree(dir);
    expect(paths.every((p) => !p.startsWith(".git"))).toBe(true);
  });

  it("reads file contents", async () => {
    writeFileSync(join(dir, "hello.txt"), "hello world");
    const result = await readFileForWorktree(dir, "hello.txt");
    expect(result.content).toBe("hello world");
    expect(result.path).toBe("hello.txt");
    expect(result.truncated).toBe(false);
  });

  it("rejects path traversal", async () => {
    await expect(readFileForWorktree(dir, "../outside.txt")).rejects.toThrow(
      /escapes worktree/,
    );
  });

  it("returns empty array for empty directory", async () => {
    const empty = mkdtempSync(join(tmpdir(), "lan-term-empty-"));
    try {
      const paths = await listFilesForWorktree(empty);
      expect(paths).toEqual([]);
    } finally {
      rmSync(empty, { recursive: true, force: true });
    }
  });
});
