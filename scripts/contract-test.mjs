#!/usr/bin/env node
/**
 * Contract test: spawns Hono on :4740 and Go on :4741 with the same temp data dir.
 * For each fixture: sends request to both servers and asserts JSON deep-equality.
 * Exits 0 on pass, 1 on failure.
 */

import { spawn } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir, homedir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const GO_BINARY = join(ROOT, "bin", "workbench-cli");
const HONO_PORT = 4740;
const GO_PORT = 4741;
const POLL_MS = 300;
const TIMEOUT_MS = 20_000;
const VOLATILE_FIELDS = new Set(["createdAt", "updatedAt", "id", "sid", "expiresAt"]);

async function poll(url, maxMs) {
  const deadline = Date.now() + maxMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (res.ok) return true;
    } catch { /* not ready */ }
    await new Promise(r => setTimeout(r, POLL_MS));
  }
  return false;
}

function deepEqual(a, b, path = "") {
  if (typeof a !== typeof b) return [`${path}: type mismatch (${typeof a} vs ${typeof b})`];
  if (a === null || b === null) return a === b ? [] : [`${path}: ${JSON.stringify(a)} !== ${JSON.stringify(b)}`];
  if (typeof a !== "object") return a === b ? [] : [`${path}: ${JSON.stringify(a)} !== ${JSON.stringify(b)}`];
  if (Array.isArray(a) !== Array.isArray(b)) return [`${path}: array mismatch`];
  if (Array.isArray(a)) {
    if (a.length !== b.length) return [`${path}: array length ${a.length} vs ${b.length}`];
    return a.flatMap((v, i) => deepEqual(v, b[i], `${path}[${i}]`));
  }
  const diffs = [];
  for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
    if (VOLATILE_FIELDS.has(key)) continue;
    diffs.push(...deepEqual(a[key], b[key], path ? `${path}.${key}` : key));
  }
  return diffs;
}

// Built-in fixtures
const fixtures = [
  { label: "GET /api/health", method: "GET", path: "/api/health", ignoreBody: false },
];

// Add fixture JSON files from server-go/test/contract/fixtures/ if they exist
try {
  const fixtureDir = join(ROOT, "server-go", "test", "contract", "fixtures");
  const { readdirSync, readFileSync } = await import("node:fs");
  for (const file of readdirSync(fixtureDir).filter(f => f.endsWith(".json"))) {
    fixtures.push(JSON.parse(readFileSync(join(fixtureDir, file), "utf8")));
  }
} catch { /* no fixtures dir */ }

const dataDir = mkdtempSync(join(tmpdir(), "workbench-contract-"));

const honoEnv = { ...process.env, WORKBENCH_DATA_DIR: dataDir };
const goEnv   = { ...process.env, WORKBENCH_DATA_DIR: dataDir };

const honoProc = spawn("node", ["node_modules/.bin/tsx", "server/index.ts"], {
  cwd: ROOT,
  env: { ...honoEnv, PORT: String(HONO_PORT), WORKBENCH_HOST: "127.0.0.1" },
  stdio: ["ignore", "pipe", "pipe"],
});
honoProc.stdout.on("data", () => {});
honoProc.stderr.on("data", () => {});

const goProc = spawn(GO_BINARY, ["--http", `-p`, String(GO_PORT), "-y"], {
  cwd: ROOT,
  env: goEnv,
  stdio: ["ignore", "pipe", "pipe"],
});
goProc.stdout.on("data", () => {});
goProc.stderr.on("data", () => {});

let passed = 0, failed = 0;

try {
  console.log("Waiting for servers to start...");
  const [honoReady, goReady] = await Promise.all([
    poll(`http://127.0.0.1:${HONO_PORT}/api/health`, TIMEOUT_MS),
    poll(`http://127.0.0.1:${GO_PORT}/api/health`, TIMEOUT_MS),
  ]);

  if (!honoReady) { console.error("Hono server failed to start"); process.exit(1); }
  if (!goReady)   { console.error("Go server failed to start"); process.exit(1); }
  console.log("Both servers ready.\n");

  for (const fixture of fixtures) {
    const { label, method = "GET", path, headers = {}, body } = fixture;

    const opts = {
      method,
      headers: { "Content-Type": "application/json", ...headers },
      ...(body ? { body: JSON.stringify(body) } : {}),
    };

    const [honoRes, goRes] = await Promise.all([
      fetch(`http://127.0.0.1:${HONO_PORT}${path}`, opts),
      fetch(`http://127.0.0.1:${GO_PORT}${path}`, opts),
    ]);

    if (honoRes.status !== goRes.status) {
      console.error(`FAIL [${label}]: status ${honoRes.status} vs ${goRes.status}`);
      failed++;
      continue;
    }

    let honoBody, goBody;
    try {
      [honoBody, goBody] = await Promise.all([honoRes.json(), goRes.json()]);
    } catch {
      console.log(`PASS [${label}] (non-JSON body, status match)`);
      passed++;
      continue;
    }

    const diffs = deepEqual(honoBody, goBody);
    if (diffs.length === 0) {
      console.log(`PASS [${label}]`);
      passed++;
    } else {
      console.error(`FAIL [${label}]:`);
      for (const d of diffs) console.error(`  ${d}`);
      failed++;
    }
  }
} finally {
  honoProc.kill("SIGTERM");
  goProc.kill("SIGTERM");
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
