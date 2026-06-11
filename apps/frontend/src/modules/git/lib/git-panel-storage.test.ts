import { describe, expect, it } from "vitest";
import {
  GIT_PANEL_TAB_SCOPES,
  isGitPanelTabScope,
  normalizeGitPanelTabScope,
} from "./git-panel-storage.js";

describe("git-panel-storage", () => {
  it("validates git panel tab scopes", () => {
    expect(isGitPanelTabScope("staged")).toBe(true);
    expect(isGitPanelTabScope("unstaged")).toBe(true);
    expect(isGitPanelTabScope("untracked")).toBe(true);
    expect(isGitPanelTabScope("invalid")).toBe(false);
    expect(isGitPanelTabScope(undefined)).toBe(false);
  });

  it("exposes untracked as a first-class tab scope", () => {
    expect(GIT_PANEL_TAB_SCOPES).toContain("untracked");
  });

  it("round-trips every known tab scope", () => {
    expect(normalizeGitPanelTabScope("untracked")).toBe("untracked");
    expect(normalizeGitPanelTabScope("staged")).toBe("staged");
    expect(normalizeGitPanelTabScope("unstaged")).toBe("unstaged");
    expect(normalizeGitPanelTabScope("invalid")).toBeUndefined();
  });
});
