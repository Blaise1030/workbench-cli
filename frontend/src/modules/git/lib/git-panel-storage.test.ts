import { describe, expect, it } from "vitest";
import {
  isGitPanelTabScope,
  normalizeGitPanelTabScope,
} from "./git-panel-storage.js";

describe("git-panel-storage", () => {
  it("validates git panel tab scopes", () => {
    expect(isGitPanelTabScope("staged")).toBe(true);
    expect(isGitPanelTabScope("unstaged")).toBe(true);
    expect(isGitPanelTabScope("untracked")).toBe(false);
    expect(isGitPanelTabScope("invalid")).toBe(false);
    expect(isGitPanelTabScope(undefined)).toBe(false);
  });

  it("maps legacy untracked tab to unstaged", () => {
    expect(normalizeGitPanelTabScope("untracked")).toBe("unstaged");
    expect(normalizeGitPanelTabScope("staged")).toBe("staged");
  });
});
