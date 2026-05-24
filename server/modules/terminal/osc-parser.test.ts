import { describe, it, expect } from "vitest";
import { parseOsc133Command } from "./osc-parser.js";

describe("parseOsc133Command", () => {
  it("parses exit and base64 command", () => {
    const cmd = Buffer.from("claude --resume abc", "utf-8").toString("base64");
    const report = parseOsc133Command(`C;exit=0;cmd_b64=${cmd}`);
    expect(report?.commandExit).toBe(0);
    expect(report?.commandLine).toBe("claude --resume abc");
  });

  it("returns null for non-C payloads", () => {
    expect(parseOsc133Command("B")).toBeNull();
  });
});
