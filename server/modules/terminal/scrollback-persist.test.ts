import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as dataDir from "../../db/data-dir.js";
import {
  deleteScrollback,
  dumpScrollback,
  hasScrollbackDump,
  loadScrollback,
} from "./scrollback-persist.js";

describe("scrollback-persist", () => {
  let tempRoot: string;

  beforeEach(() => {
    tempRoot = mkdtempSync(join(tmpdir(), "lan-terminal-scrollback-"));
    vi.spyOn(dataDir, "getDataDir").mockReturnValue(tempRoot);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    rmSync(tempRoot, { recursive: true, force: true });
  });

  it("round-trips dump and load", () => {
    dumpScrollback("term-1", Buffer.from("hello\nworld"), {
      cwd: "/tmp/project",
      lastActivity: 1_700_000_000_000,
      exitCode: 0,
    });
    expect(hasScrollbackDump("term-1")).toBe(true);
    const loaded = loadScrollback("term-1");
    expect(loaded?.data.toString("utf-8")).toBe("hello\nworld");
    expect(loaded?.meta.cwd).toBe("/tmp/project");
    expect(loaded?.meta.exitCode).toBe(0);
  });

  it("deletes active and previous copies", () => {
    dumpScrollback("term-2", Buffer.from("x"), {
      cwd: "/",
      lastActivity: 1,
      exitCode: null,
    });
    deleteScrollback("term-2");
    expect(hasScrollbackDump("term-2")).toBe(false);
    expect(loadScrollback("term-2")).toBeNull();
  });
});
