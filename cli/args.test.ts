import { describe, it, expect } from "vitest";
import { parseCliArgs } from "./args.js";

describe("parseCliArgs", () => {
  it("defaults port and flags", () => {
    const args = parseCliArgs([]);
    expect(args.port).toBe(3000);
    expect(args.forceHttp).toBe(false);
    expect(args.assumeYes).toBe(false);
    expect(args.showHelp).toBe(false);
  });

  it("parses --http and --port", () => {
    const args = parseCliArgs(["--http", "-p", "4000"]);
    expect(args.forceHttp).toBe(true);
    expect(args.port).toBe(4000);
  });

  it("accepts --insecure as alias for --http", () => {
    expect(parseCliArgs(["--insecure"]).forceHttp).toBe(true);
  });

  it("parses --yes", () => {
    expect(parseCliArgs(["--yes"]).assumeYes).toBe(true);
    expect(parseCliArgs(["-y"]).assumeYes).toBe(true);
  });

  it("throws on unknown flags", () => {
    expect(() => parseCliArgs(["--nope"])).toThrow(/Unknown option/);
  });
});
