#!/usr/bin/env node
/**
 * Smoke test: spawns the Go binary, polls /api/health, checks GET / returns HTML.
 * Exits 0 on pass, 1 on failure.
 */

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const BINARY = join(ROOT, "bin", "workbench-cli");
const PORT = 4742;
const HEALTH_URL = `http://127.0.0.1:${PORT}/api/health`;
const ROOT_URL = `http://127.0.0.1:${PORT}/`;
const POLL_MS = 300;
const TIMEOUT_MS = 15_000;

if (!existsSync(BINARY)) {
  console.error(`Binary not found: ${BINARY}`);
  console.error("Run: npm run build:go");
  process.exit(1);
}

const server = spawn(BINARY, ["--http", `-p`, String(PORT), "-y"], {
  stdio: ["ignore", "pipe", "pipe"],
});

server.stdout.on("data", (d) => process.stdout.write(d));
server.stderr.on("data", (d) => process.stderr.write(d));

server.on("exit", (code) => {
  if (code !== null && code !== 0) {
    console.error(`Server exited with code ${code}`);
    process.exit(1);
  }
});

async function poll(url, maxMs) {
  const deadline = Date.now() + maxMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (res.ok) return res;
    } catch {
      // not ready yet
    }
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

let exitCode = 0;

try {
  console.log(`Polling ${HEALTH_URL} ...`);
  const healthRes = await poll(HEALTH_URL, TIMEOUT_MS);
  const health = await healthRes.json();
  if (!health.ok || health.server !== "go") {
    throw new Error(`Unexpected health response: ${JSON.stringify(health)}`);
  }
  console.log("✓ /api/health OK:", health);

  const rootRes = await fetch(ROOT_URL);
  const rootBody = await rootRes.text();
  if (!rootBody.includes("<!doctype html") && !rootBody.includes("<!DOCTYPE html")) {
    throw new Error("GET / did not return HTML");
  }
  console.log("✓ GET / returned HTML");

  console.log("\nSMOKE TEST PASSED");
} catch (err) {
  console.error("\nSMOKE TEST FAILED:", err.message);
  exitCode = 1;
} finally {
  server.kill("SIGTERM");
}

process.exit(exitCode);
