import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  claudeAdapter,
  cursorAdapter,
  geminiAdapter,
} from "./adapters.js";
import { cursorWorkspaceHash, geminiProjectHash } from "./session-utils.js";

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

describe("cursorAdapter", () => {
  let home: string;

  beforeEach(() => {
    home = mkdtempSync(join(tmpdir(), "lan-terminal-cursor-"));
  });

  afterEach(() => {
    rmSync(home, { recursive: true, force: true });
  });

  it("finds newest chat id by store.db mtime in workspace dir", () => {
    const cwd = "/Users/me/my-project";
    const workspaceId = cursorWorkspaceHash(cwd);
    const workspaceDir = join(home, ".cursor", "chats", workspaceId);
    mkdirSync(join(workspaceDir, "older-chat"), { recursive: true });
    mkdirSync(join(workspaceDir, "newer-chat"), { recursive: true });
    writeFileSync(join(workspaceDir, "older-chat", "store.db"), "x");
    writeFileSync(join(workspaceDir, "newer-chat", "store.db"), "y");

    const id = cursorAdapter.findLatestSessionId(cwd, home);
    expect(id).toBe("newer-chat");
  });

  it("resume argv uses agent --resume", () => {
    expect(cursorAdapter.resumeArgs("chat-1")).toEqual(["agent", "--resume", "chat-1"]);
  });
});

describe("geminiAdapter", () => {
  let home: string;

  beforeEach(() => {
    home = mkdtempSync(join(tmpdir(), "lan-terminal-gemini-"));
  });

  afterEach(() => {
    rmSync(home, { recursive: true, force: true });
  });

  it("finds newest session in project chats dir", () => {
    const cwd = "/Users/me/gemini-project";
    const hash = geminiProjectHash(cwd);
    const chatsDir = join(home, ".gemini", "tmp", hash, "chats");
    mkdirSync(chatsDir, { recursive: true });
    const older = join(chatsDir, "session-older.jsonl");
    const newer = join(chatsDir, "session-newer.jsonl");
    writeFileSync(
      older,
      JSON.stringify({ sessionId: "older", projectHash: hash }) + "\n",
    );
    writeFileSync(
      newer,
      JSON.stringify({ sessionId: "newer", projectHash: hash }) + "\n",
    );

    const id = geminiAdapter.findLatestSessionId(cwd, home);
    expect(id).toBe("newer");
  });

  it("resume argv uses gemini --resume", () => {
    expect(geminiAdapter.resumeArgs("sess-1")).toEqual(["gemini", "--resume", "sess-1"]);
  });
});
