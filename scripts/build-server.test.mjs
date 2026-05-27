import { describe, it, expect, beforeAll } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const bundlePath = join(root, "dist/cli/index.cjs");

describe("build-server.mjs", () => {
  beforeAll(() => {
    execFileSync("node", ["scripts/build-server.mjs"], {
      cwd: root,
      stdio: "pipe",
    });
  });

  it("produces a minified server bundle", () => {
    expect(existsSync(bundlePath)).toBe(true);
    const bundle = readFileSync(bundlePath, "utf8");
    expect(bundle.startsWith("#!/usr/bin/env node")).toBe(true);
    // Minified output should not contain readable multi-line test helpers.
    expect(bundle).not.toMatch(/\bvitest\b/);
    expect(bundle).not.toMatch(/\.test\.ts/);
  });

  it("does not leave legacy dist/server test artifacts", () => {
    expect(existsSync(join(root, "dist/server/app.test.js"))).toBe(false);
    expect(existsSync(join(root, "dist/server"))).toBe(false);
  });
});
