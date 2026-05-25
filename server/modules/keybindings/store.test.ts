import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getKeybindings, putKeybindings } from "./store.js";
import { KEYBINDING_OPTIONS } from "./store.js";

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), "keybindings-test-"));
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

describe("getKeybindings", () => {
  it("returns built-in options when file does not exist", async () => {
    const result = await getKeybindings(join(tmpDir, "missing.json"));
    expect(result).toEqual(KEYBINDING_OPTIONS);
  });

  it("merges file overrides over built-in options", async () => {
    const filePath = join(tmpDir, "kb.json");
    await putKeybindings({ ...KEYBINDING_OPTIONS, "terminal.newTerminal": "Ctrl+t" }, filePath);
    const result = await getKeybindings(filePath);
    expect(result["terminal.newTerminal"]).toBe("Ctrl+t");
    expect(result["panel.git"]).toBe(KEYBINDING_OPTIONS["panel.git"]);
  });
});

describe("putKeybindings", () => {
  it("writes the map and reads it back unchanged", async () => {
    const filePath = join(tmpDir, "kb.json");
    const custom = { ...KEYBINDING_OPTIONS, "panel.explorer": "Meta+f" };
    await putKeybindings(custom, filePath);
    const result = await getKeybindings(filePath);
    expect(result["panel.explorer"]).toBe("Meta+f");
  });

  it("creates parent directory if missing", async () => {
    const filePath = join(tmpDir, "nested", "dir", "kb.json");
    await expect(putKeybindings(KEYBINDING_OPTIONS, filePath)).resolves.not.toThrow();
  });
});
