import { describe, it, expect } from "vitest";
import { parseResize } from "./pty.js";

describe("parseResize", () => {
  it("parses a valid RESIZE message", () => {
    expect(parseResize("\x1b[RESIZE:80;24]")).toEqual({ cols: 80, rows: 24 });
    expect(parseResize("\x1b[RESIZE:220;50]")).toEqual({ cols: 220, rows: 50 });
  });

  it("returns null for non-RESIZE input", () => {
    expect(parseResize("hello")).toBeNull();
    expect(parseResize("\x1b[RESIZE:abc;def]")).toBeNull();
    expect(parseResize("")).toBeNull();
  });
});
