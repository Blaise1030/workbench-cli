import { describe, expect, it, beforeEach, vi } from "vitest";
import {
  auxPanelsStateFromClient,
  clientPanelsFromState,
  explorerPanelId,
  gitPanelId,
  loadAuxPanels,
  saveAuxPanels,
} from "./worktree-panels-storage.js";

const WORKTREE = "wt-1";

describe("worktree-panels-storage", () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
      clear: () => store.clear(),
    });
  });

  it("round-trips aux panel flags per worktree", () => {
    saveAuxPanels(WORKTREE, { git: true, explorer: false, activeTabId: null });
    expect(loadAuxPanels(WORKTREE)).toEqual({
      git: true,
      explorer: false,
      activeTabId: null,
    });
  });

  it("persists active tab id", () => {
    saveAuxPanels(WORKTREE, {
      git: true,
      explorer: false,
      activeTabId: "term-abc",
    });
    expect(loadAuxPanels(WORKTREE).activeTabId).toBe("term-abc");
  });

  it("builds stable client panel ids", () => {
    const panels = clientPanelsFromState(WORKTREE, { git: true, explorer: true });
    expect(panels).toEqual([
      { id: gitPanelId(WORKTREE), type: "git", title: "Git" },
      { id: explorerPanelId(WORKTREE), type: "explorer", title: "Files" },
    ]);
    expect(auxPanelsStateFromClient(panels)).toEqual({
      git: true,
      explorer: true,
      activeTabId: null,
    });
  });
});
