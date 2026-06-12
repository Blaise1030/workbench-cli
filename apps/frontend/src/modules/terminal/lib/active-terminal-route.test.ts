import { describe, expect, it } from "vitest";
import { fallbackTerminalIdForRoute } from "./active-terminal-route.js";

const list = (...ids: string[]) => ids.map((id) => ({ id }));

describe("fallbackTerminalIdForRoute", () => {
  it("returns null when the routed terminal exists in the worktree's list", () => {
    expect(fallbackTerminalIdForRoute(list("a", "b"), "b")).toBeNull();
  });

  it("returns the first terminal when the routed terminal is missing", () => {
    expect(fallbackTerminalIdForRoute(list("a", "b"), "gone")).toBe("a");
  });

  it("returns null while the list for the worktree has not loaded", () => {
    // During an in-place worktree switch the cache may not yet hold the new
    // worktree's terminals — never bounce the route off the selected tab then.
    expect(fallbackTerminalIdForRoute(undefined, "b")).toBeNull();
  });

  it("returns null when there is no active terminal", () => {
    expect(fallbackTerminalIdForRoute(list("a"), undefined)).toBeNull();
  });

  it("returns null for an empty list rather than an undefined id", () => {
    expect(fallbackTerminalIdForRoute(list(), "b")).toBeNull();
  });
});
