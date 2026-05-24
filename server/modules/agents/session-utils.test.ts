import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  cursorWorkspaceHash,
  geminiProjectHash,
  readFirstJsonLine,
  sessionIdFromGeminiFile,
} from "./session-utils.js";

describe("session-utils", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "lan-terminal-session-utils-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("cursorWorkspaceHash is stable md5 hex", () => {
    expect(cursorWorkspaceHash("/tmp/foo")).toMatch(/^[a-f0-9]{32}$/);
    expect(cursorWorkspaceHash("/tmp/foo")).toBe(cursorWorkspaceHash("/tmp/foo"));
  });

  it("geminiProjectHash is stable sha256 hex", () => {
    expect(geminiProjectHash("/tmp/foo")).toMatch(/^[a-f0-9]{64}$/);
  });

  it("readFirstJsonLine parses first line only", () => {
    const file = join(dir, "session.jsonl");
    writeFileSync(file, '{"sessionId":"abc","projectHash":"hash"}\n{"ignored":true}\n');
    expect(readFirstJsonLine(file)).toEqual({ sessionId: "abc", projectHash: "hash" });
  });

  it("sessionIdFromGeminiFile prefers sessionId in header", () => {
    const file = join(dir, "session-ignored-name.jsonl");
    writeFileSync(file, '{"sessionId":"from-header"}\n');
    expect(sessionIdFromGeminiFile(file)).toBe("from-header");
  });
});
