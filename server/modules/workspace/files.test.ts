import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  listFilesForWorktree,
  readFileForWorktree,
  searchFilesForWorktree,
  contentSearchFilesForWorktree,
} from "./files.js";

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

describe("searchFilesForWorktree", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "search-test-"));
    await mkdir(join(dir, "src/components"), { recursive: true });
    await mkdir(join(dir, "src/pages"), { recursive: true });
    await writeFile(join(dir, "src/components/Button.vue"), "");
    await writeFile(join(dir, "src/components/InputGroup.vue"), "");
    await writeFile(join(dir, "src/pages/HomePage.vue"), "");
    await writeFile(join(dir, "README.md"), "");
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("returns paths ranked by filename match quality", async () => {
    const results = await searchFilesForWorktree(dir, "button", 10);
    expect(results[0]).toBe("src/components/Button.vue");
  });

  it("returns empty array when no match", async () => {
    const results = await searchFilesForWorktree(dir, "zzznomatch", 10);
    expect(results).toEqual([]);
  });

  it("respects the limit", async () => {
    const results = await searchFilesForWorktree(dir, "vue", 2);
    expect(results.length).toBeLessThanOrEqual(2);
  });

  it("matches partial filename", async () => {
    const results = await searchFilesForWorktree(dir, "group", 10);
    expect(results).toContain("src/components/InputGroup.vue");
  });
});

describe("contentSearchFilesForWorktree", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "content-search-test-"));
    await mkdir(join(dir, "src"), { recursive: true });
    await writeFile(join(dir, "src/index.ts"), "export const hello = 'world';\nexport const foo = 42;\n");
    await writeFile(join(dir, "src/utils.ts"), "export function greet(name: string) {\n  return `hello ${name}`;\n}\n");
    await writeFile(join(dir, "README.md"), "# Project\n\nThis is a hello world example.\n");
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("returns matches with correct file, line, and text", async () => {
    const matches = await contentSearchFilesForWorktree(dir, "hello", 50);
    const files = matches.map((m) => m.file);
    expect(files).toContain("src/index.ts");
    expect(files).toContain("src/utils.ts");
    expect(files).toContain("README.md");
  });

  it("returns correct line numbers", async () => {
    const matches = await contentSearchFilesForWorktree(dir, "foo", 50);
    expect(matches).toHaveLength(1);
    expect(matches[0].file).toBe("src/index.ts");
    expect(matches[0].line).toBe(2);
    expect(matches[0].text).toBe("export const foo = 42;");
  });

  it("returns empty array for empty query", async () => {
    const matches = await contentSearchFilesForWorktree(dir, "", 50);
    expect(matches).toEqual([]);
  });

  it("returns empty array for whitespace-only query", async () => {
    const matches = await contentSearchFilesForWorktree(dir, "   ", 50);
    expect(matches).toEqual([]);
  });

  it("respects the limit", async () => {
    const matches = await contentSearchFilesForWorktree(dir, "hello", 2);
    expect(matches).toHaveLength(2);
  });

  it("is case-insensitive", async () => {
    const matches = await contentSearchFilesForWorktree(dir, "HELLO", 50);
    expect(matches.length).toBeGreaterThan(0);
  });
});
