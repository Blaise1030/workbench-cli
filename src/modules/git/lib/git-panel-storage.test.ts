import { describe, expect, it } from "vitest";
import { isGitPanelTabScope } from "./git-panel-storage.js";

describe("git-panel-storage", () => {
  it("validates git panel tab scopes", () => {
    expect(isGitPanelTabScope("staged")).toBe(true);
    expect(isGitPanelTabScope("unstaged")).toBe(true);
    expect(isGitPanelTabScope("untracked")).toBe(true);
    expect(isGitPanelTabScope("invalid")).toBe(false);
    expect(isGitPanelTabScope(undefined)).toBe(false);
  });
});
