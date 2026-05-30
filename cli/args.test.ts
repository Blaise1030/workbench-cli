import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseCliArgs } from "./args.js";
import { DEFAULT_NETWORK_PORT } from "./network-config.js";

let tempHome: string;
const originalHome = process.env.HOME;

beforeEach(() => {
  tempHome = mkdtempSync(join(tmpdir(), "workbench-args-test-"));
  process.env.HOME = tempHome;
  delete process.env.PORT;
  delete process.env.WORKBENCH_HOST;
});

afterEach(() => {
  process.env.HOME = originalHome;
  delete process.env.PORT;
  delete process.env.WORKBENCH_HOST;
  rmSync(tempHome, { recursive: true, force: true });
});

describe("parseCliArgs", () => {
  it("defaults port, host, and flags", () => {
    const args = parseCliArgs([]);
    expect(args.port).toBe(DEFAULT_NETWORK_PORT);
    expect(args.host).toBe("workbench.local");
    expect(args.forceHttp).toBe(false);
    expect(args.assumeYes).toBe(false);
    expect(args.showHelp).toBe(false);
  });

  it("parses --http, --port, and --host", () => {
    const args = parseCliArgs(["--http", "-p", "4000", "--host", "dev.local"]);
    expect(args.forceHttp).toBe(true);
    expect(args.port).toBe(4000);
    expect(args.host).toBe("dev.local");
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
