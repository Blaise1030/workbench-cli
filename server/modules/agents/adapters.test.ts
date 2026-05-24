import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { claudeAdapter } from "./adapters.js";

describe("claudeAdapter", () => {
  let home: string;

  beforeEach(() => {
    home = mkdtempSync(join(tmpdir(), "lan-terminal-claude-"));
  });

  afterEach(() => {
    rmSync(home, { recursive: true, force: true });
  });

  it("finds newest session jsonl in project dir", () => {
    const cwd = "/Users/me/my-project";
    const projectDir = join(home, ".claude", "projects", "-Users-me-my-project");
    mkdirSync(projectDir, { recursive: true });
    writeFileSync(join(projectDir, "older.jsonl"), "{}");
    writeFileSync(join(projectDir, "newer-id.jsonl"), "{}");

    const id = claudeAdapter.findLatestSessionId(cwd, home);
    expect(id).toBe("newer-id");
  });
});
