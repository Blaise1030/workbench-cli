import { describe, expect, it } from "vitest";
import {
  nextLayoutMode,
  splitAuxPanelFromState,
} from "./use-worktree-layout-mode.js";

describe("use-worktree-layout-mode", () => {
  it("toggles between page and split layout modes", () => {
    expect(nextLayoutMode("page")).toBe("split");
    expect(nextLayoutMode("split")).toBe("page");
  });

  it("derives the active split aux panel from stored panel state", () => {
    expect(splitAuxPanelFromState({ git: true, explorer: true })).toBe("git");
    expect(splitAuxPanelFromState({ git: false, explorer: true })).toBe(
      "explorer",
    );
    expect(splitAuxPanelFromState({ git: false, explorer: false })).toBeNull();
  });
});
