import { describe, expect, it } from "vitest";
import {
  clientPanelsFromState,
  explorerPanelId,
  gitPanelId,
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
});
