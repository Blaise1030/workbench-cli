import { describe, expect, it } from "vitest";
import {
  activateDefaultSplitAuxPanel,
  activateWorktreeAuxPanel,
  buildWorkspaceQuery,
  clampSplitTerminalSize,
  clientPanelsFromState,
  explorerPanelId,
  gitPanelId,
  migrateLayoutPrefsToWorkspace,
  migrateWorktreeLayoutToProject,
  SPLIT_TERMINAL_DEFAULT_SIZE,
  SPLIT_TERMINAL_MAX_SIZE,
  SPLIT_TERMINAL_MIN_SIZE,
} from "./worktree-panels-storage.js";

const WORKTREE = "wt-1";

describe("worktree-panels-storage", () => {
  it("generates stable git panel ids", () => {
    expect(gitPanelId(WORKTREE)).toBe("panel-git-wt-1");
    expect(gitPanelId("wt-abc")).toBe("panel-git-wt-abc");
  });

  it("generates stable explorer panel ids", () => {
    expect(explorerPanelId(WORKTREE)).toBe("panel-explorer-wt-1");
    expect(explorerPanelId("wt-abc")).toBe("panel-explorer-wt-abc");
  });

  it("builds client panels based on state flags", () => {
    const panels = clientPanelsFromState(WORKTREE, {
      git: true,
      explorer: true,
    });
    expect(panels).toEqual([
      { id: gitPanelId(WORKTREE), type: "git", title: "Git" },
      { id: explorerPanelId(WORKTREE), type: "explorer", title: "Files" },
    ]);
  });

  it("includes only enabled panels", () => {
    const panelsGitOnly = clientPanelsFromState(WORKTREE, {
      git: true,
      explorer: false,
    });
    expect(panelsGitOnly).toEqual([
      { id: gitPanelId(WORKTREE), type: "git", title: "Git" },
    ]);

    const panelsExplorerOnly = clientPanelsFromState(WORKTREE, {
      git: false,
      explorer: true,
    });
    expect(panelsExplorerOnly).toEqual([
      { id: explorerPanelId(WORKTREE), type: "explorer", title: "Files" },
    ]);

    const panelsNone = clientPanelsFromState(WORKTREE, {
      git: false,
      explorer: false,
    });
    expect(panelsNone).toEqual([]);
  });

  it("activates explorer as the selected aux panel", () => {
    expect(
      activateWorktreeAuxPanel(
        { git: true, explorer: false, lastRoute: "git" },
        "explorer",
      ),
    ).toEqual({
      git: false,
      explorer: true,
      lastRoute: "explorer",
    });
  });

  it("activates git as the selected aux panel", () => {
    expect(
      activateWorktreeAuxPanel(
        { git: false, explorer: true, lastRoute: "explorer" },
        "git",
      ),
    ).toEqual({
      git: true,
      explorer: false,
      lastRoute: "git",
    });
  });

  it("activates explorer as the default split aux panel when none is selected", () => {
    expect(
      activateDefaultSplitAuxPanel({
        git: false,
        explorer: false,
        lastRoute: "terminal",
        lastTerminalId: "term-1",
      }),
    ).toEqual({
      git: false,
      explorer: true,
      lastRoute: "explorer",
      lastTerminalId: "term-1",
    });
  });

  it("keeps the selected aux panel when activating the default split panel", () => {
    const state = { git: true, explorer: false, lastRoute: "git" } as const;

    expect(activateDefaultSplitAuxPanel(state)).toBe(state);
  });

  it("buildWorkspaceQuery includes tab and file from storage", () => {
    const query = buildWorkspaceQuery(
      "/repo/wt",
      { activeTab: "staged" },
      { lastFilePath: "src/a.ts" },
    );
    expect(query.tab).toBe("staged");
    expect(query.file).toBe(encodeURIComponent("/repo/wt/src/a.ts"));
  });

  it("buildWorkspaceQuery includes tab only when no file", () => {
    const query = buildWorkspaceQuery("/repo/wt", { activeTab: "unstaged" }, {});
    expect(query).toEqual({ tab: "unstaged" });
  });

  it("buildWorkspaceQuery omits file without worktree path", () => {
    const query = buildWorkspaceQuery(undefined, {}, { lastFilePath: "a.ts" });
    expect(query).toEqual({ tab: "unstaged" });
  });

  it("buildWorkspaceQuery preserves the untracked tab", () => {
    const query = buildWorkspaceQuery("/wt", { activeTab: "untracked" }, {});
    expect(query.tab).toBe("untracked");
  });

  it("clampSplitTerminalSize enforces bounds", () => {
    expect(clampSplitTerminalSize(10)).toBe(SPLIT_TERMINAL_MIN_SIZE);
    expect(clampSplitTerminalSize(90)).toBe(SPLIT_TERMINAL_MAX_SIZE);
    expect(clampSplitTerminalSize(55.4)).toBe(55);
    expect(clampSplitTerminalSize(SPLIT_TERMINAL_DEFAULT_SIZE)).toBe(
      SPLIT_TERMINAL_DEFAULT_SIZE,
    );
  });

  it("migrateWorktreeLayoutToProject copies legacy worktree prefs once", () => {
    const migrated = migrateWorktreeLayoutToProject(
      { git: true, explorer: false, layoutMode: "split", splitTerminalSize: 42 },
      {},
    );
    expect(migrated).toEqual({ layoutMode: "split", splitTerminalSize: 42 });

    expect(
      migrateWorktreeLayoutToProject(
        { git: false, explorer: false, layoutMode: "page" },
        { layoutMode: "split", splitTerminalSize: 50 },
      ),
    ).toBeNull();
  });

  it("migrateLayoutPrefsToWorkspace prefers existing workspace prefs", () => {
    expect(
      migrateLayoutPrefsToWorkspace(
        { layoutMode: "page", splitTerminalSize: 60 },
        { layoutMode: "split", splitTerminalSize: 42 },
      ),
    ).toBeNull();
  });

  it("migrateLayoutPrefsToWorkspace fills missing workspace prefs from legacy prefs", () => {
    expect(
      migrateLayoutPrefsToWorkspace(
        {},
        { layoutMode: "split" },
        { git: true, explorer: false, splitTerminalSize: 42 },
      ),
    ).toEqual({ layoutMode: "split", splitTerminalSize: 42 });
  });
});
