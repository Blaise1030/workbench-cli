import { describe, expect, it } from "vitest";
import { sessionContextLabel } from "./session-context-label";

describe("sessionContextLabel", () => {
  it("joins project name and branch with a middot", () => {
    expect(sessionContextLabel({ projectName: "v2", branch: "main" })).toBe("v2 · main");
  });

  it("shows just the project name when branch is null", () => {
    expect(sessionContextLabel({ projectName: "v2", branch: null })).toBe("v2");
  });

  it("shows just the project name when branch is an empty string", () => {
    expect(sessionContextLabel({ projectName: "v2", branch: "" })).toBe("v2");
  });

  it("returns an empty string when there is no project name", () => {
    expect(sessionContextLabel({ projectName: "", branch: "main" })).toBe("");
  });
});
