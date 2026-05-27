import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  defaultNetworkConfig,
  loadNetworkConfig,
  resolveNetworkConfig,
  saveNetworkConfig,
  hostsFileLine,
} from "./network-config.js";

let tempHome: string;
const originalHome = process.env.HOME;

beforeEach(() => {
  tempHome = mkdtempSync(join(tmpdir(), "workbench-config-test-"));
  process.env.HOME = tempHome;
});

afterEach(() => {
  process.env.HOME = originalHome;
  delete process.env.PORT;
  delete process.env.WORKBENCH_HOST;
  rmSync(tempHome, { recursive: true, force: true });
});

describe("network-config", () => {
  it("returns defaults when no file exists", () => {
    expect(loadNetworkConfig()).toEqual(defaultNetworkConfig());
  });

  it("persists and reloads config", () => {
    saveNetworkConfig({ host: "dev.local", port: 5000 });
    expect(loadNetworkConfig()).toEqual({ host: "dev.local", port: 5000 });
  });

  it("rejects invalid host on save", () => {
    expect(() => saveNetworkConfig({ host: "not valid!" })).toThrow();
  });

  it("resolveNetworkConfig prefers CLI over env over file", () => {
    saveNetworkConfig({ host: "file.local", port: 4000 });
    process.env.PORT = "5000";
    process.env.WORKBENCH_HOST = "env.local";
    expect(resolveNetworkConfig({ port: 6000, host: "cli.local" })).toEqual({
      host: "cli.local",
      port: 6000,
    });
    expect(resolveNetworkConfig()).toEqual({ host: "env.local", port: 5000 });
    delete process.env.WORKBENCH_HOST;
    expect(resolveNetworkConfig()).toEqual({ host: "file.local", port: 5000 });
  });

  it("formats hosts file line", () => {
    expect(hostsFileLine("workbench.local")).toBe("127.0.0.1 workbench.local");
  });

  it("falls back to defaults for corrupt config file", () => {
    const dir = join(tempHome, ".workbench");
    const path = join(dir, "config.json");
    mkdirSync(dir, { recursive: true });
    writeFileSync(path, "{ not json", "utf8");
    expect(loadNetworkConfig()).toEqual(defaultNetworkConfig());
  });
});
