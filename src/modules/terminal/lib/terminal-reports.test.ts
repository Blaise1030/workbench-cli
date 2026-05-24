import { describe, expect, it } from "vitest";
import { formatTabLabel, parseOscStream, pathBasename } from "./terminal-reports.js";

describe("pathBasename", () => {
  it("returns last segment", () => {
    expect(pathBasename("/Users/me/v2")).toBe("v2");
  });
});

describe("parseOscStream", () => {
  it("parses OSC 7 cwd", () => {
    const chunk = "\x1b]7;file://localhost/Users/me/v2\x07";
    const { reports, carry } = parseOscStream("", chunk);
    expect(carry).toBe("");
    expect(reports).toEqual([{ cwd: "/Users/me/v2" }]);
  });

  it("parses OSC 0 title", () => {
    const chunk = "\x1b]0;v2 — zsh\x07";
    const { reports } = parseOscStream("", chunk);
    expect(reports).toEqual([{ title: "v2 — zsh" }]);
  });

  it("parses OSC 133 command exit", () => {
    const chunk = "\x1b]133;C;exit=0\x1b\\";
    const { reports } = parseOscStream("", chunk);
    expect(reports).toEqual([{ commandExit: 0 }]);
  });

  it("parses OSC 133 non-zero exit", () => {
    const chunk = "\x1b]133;C;exit=1\x07";
    const { reports } = parseOscStream("", chunk);
    expect(reports).toEqual([{ commandExit: 1 }]);
  });
});

describe("formatTabLabel", () => {
  it("prefers window title", () => {
    expect(
      formatTabLabel({
        cwd: "/Users/me/v2",
        windowTitle: "v2 — node",
        shellName: "zsh",
        fallback: "Terminal",
      }),
    ).toBe("v2 — node");
  });

  it("falls back to cwd basename and shell", () => {
    expect(
      formatTabLabel({
        cwd: "/Users/me/v2",
        windowTitle: null,
        shellName: "zsh",
        fallback: "Terminal",
      }),
    ).toBe("v2 — zsh");
  });
});
