# Benchmark Script Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create `scripts/benchmark.mjs` that starts both servers, measures startup time and throughput via autocannon, prints a side-by-side table, and appends results to `bench-results.json`.

**Architecture:** Single Node.js ESM script that sequentially spawns each server, polls `/api/health` to measure startup, runs `autocannon` programmatically, then kills the process. Results are formatted into a table and persisted to JSON.

**Tech Stack:** Node.js ESM (`import`), `autocannon` (npm), `node:child_process` spawn, `node:fs` for JSON persistence.

---

## Files

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `scripts/benchmark.mjs` | Full benchmark script |
| Modify | `package.json` | Add `bench` script + `autocannon` devDependency |

---

### Task 1: Install autocannon

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install autocannon as devDependency**

```bash
npm install --save-dev autocannon
```

Expected output: `added 1 package` (or similar)

- [ ] **Step 2: Verify it installed**

```bash
node -e "import('autocannon').then(m => console.log('ok', typeof m.default))"
```

Expected: `ok function`

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add autocannon devDependency for benchmarking"
```

---

### Task 2: Create benchmark script

**Files:**
- Create: `scripts/benchmark.mjs`

- [ ] **Step 1: Create the script**

Create `/Users/blaisetiong/Developer/v2/scripts/benchmark.mjs` with this exact content:

```js
/**
 * Benchmark TypeScript (Hono/Node.js) vs Rust server.
 *
 *   npm run bench
 *
 * Measures startup time and throughput (req/s, p50/p99/p99.9 latency).
 * Appends results to bench-results.json.
 */
import { spawn } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import autocannon from "autocannon";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const TS_PORT = 4740;
const RUST_PORT = 4741;
const HOST = "127.0.0.1";
const DURATION_SECS = 10;
const CONNECTIONS = 50;
const pathWithCargo = `${join(homedir(), ".cargo/bin")}:${process.env.PATH ?? ""}`;

const rustBinary = join(
  root,
  "server-rs/target/release",
  process.platform === "win32" ? "workbench-cli.exe" : "workbench-cli",
);

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitForHealth(port, maxMs = 30_000) {
  const deadline = Date.now() + maxMs;
  const url = `http://${HOST}:${port}/api/health`;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      // server still starting
    }
    await sleep(100);
  }
  throw new Error(`Server on port ${port} not ready within ${maxMs}ms`);
}

function runAutocannon(port) {
  return new Promise((resolve, reject) => {
    const instance = autocannon(
      {
        url: `http://${HOST}:${port}/api/health`,
        duration: DURATION_SECS,
        connections: CONNECTIONS,
        silent: true,
      },
      (err, result) => {
        if (err) reject(err);
        else resolve(result);
      },
    );
    autocannon.track(instance, { renderProgressBar: true });
  });
}

async function benchServer(label, spawnArgs, port) {
  console.log(`\n▶  Starting ${label} server on port ${port}...`);
  const child = spawn(spawnArgs[0], spawnArgs.slice(1), {
    cwd: root,
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, PATH: pathWithCargo, NODE_ENV: "production" },
  });

  child.stderr?.on("data", () => {}); // suppress stderr noise

  const t0 = Date.now();
  try {
    await waitForHealth(port);
  } catch (err) {
    child.kill("SIGKILL");
    throw err;
  }
  const startupMs = Date.now() - t0;
  console.log(`   Ready in ${startupMs}ms`);

  console.log(`   Running autocannon (${DURATION_SECS}s, ${CONNECTIONS} connections)...`);
  const result = await runAutocannon(port);

  child.kill("SIGTERM");
  await sleep(300);
  if (!child.killed) child.kill("SIGKILL");

  return {
    startupMs,
    reqPerSec: Math.round(result.requests.average),
    p50: result.latency.p50,
    p99: result.latency.p99,
    p999: result.latency.p999,
  };
}

function padEnd(str, len) {
  return String(str).padEnd(len);
}
function padStart(str, len) {
  return String(str).padStart(len);
}

function printTable(ts, rust) {
  const rows = [
    ["Startup (ms)", ts.startupMs, rust.startupMs],
    ["Req/s", ts.reqPerSec, rust.reqPerSec],
    ["Latency p50 (ms)", ts.p50, rust.p50],
    ["Latency p99 (ms)", ts.p99, rust.p99],
    ["Latency p99.9 (ms)", ts.p999, rust.p999],
  ];

  const col0 = 22;
  const col1 = 14;
  const col2 = 14;
  const line = `┼${"─".repeat(col0 + 2)}┼${"─".repeat(col1 + 2)}┼${"─".repeat(col2 + 2)}┼`;

  console.log(`\n┌${"─".repeat(col0 + 2)}┬${"─".repeat(col1 + 2)}┬${"─".repeat(col2 + 2)}┐`);
  console.log(`│ ${padEnd("", col0)} │ ${padEnd("TypeScript", col1)} │ ${padEnd("Rust", col2)} │`);
  console.log(`├${line.slice(1, -1)}┤`);
  for (const [label, tsVal, rustVal] of rows) {
    const winner = rustVal < tsVal ? " ✓" : "";
    console.log(
      `│ ${padEnd(label, col0)} │ ${padStart(tsVal, col1)} │ ${padStart(rustVal + winner, col2)} │`,
    );
  }
  console.log(`└${"─".repeat(col0 + 2)}┴${"─".repeat(col1 + 2)}┴${"─".repeat(col2 + 2)}┘`);
}

function appendResults(ts, rust) {
  const resultsPath = join(root, "bench-results.json");
  let history = [];
  if (existsSync(resultsPath)) {
    try {
      history = JSON.parse(readFileSync(resultsPath, "utf8"));
    } catch {
      history = [];
    }
  }
  history.push({ timestamp: new Date().toISOString(), typescript: ts, rust });
  writeFileSync(resultsPath, JSON.stringify(history, null, 2));
  console.log(`\n  Results appended to bench-results.json`);
}

async function main() {
  if (!existsSync(rustBinary)) {
    console.error(`\nRust binary not found: ${rustBinary}`);
    console.error("Run: npm run build:rust\n");
    process.exit(1);
  }

  let tsResult, rustResult;

  try {
    tsResult = await benchServer("TypeScript", ["npx", "tsx", "cli/index.ts", "--host", HOST, "--http", "-p", String(TS_PORT), "-y"], TS_PORT);
  } catch (err) {
    console.error("TypeScript server benchmark failed:", err.message);
    process.exit(1);
  }

  try {
    rustResult = await benchServer("Rust", [rustBinary, "--host", HOST, "--http", "-p", String(RUST_PORT), "-y"], RUST_PORT);
  } catch (err) {
    console.error("Rust server benchmark failed:", err.message);
    process.exit(1);
  }

  printTable(tsResult, rustResult);
  appendResults(tsResult, rustResult);
}

main();
```

- [ ] **Step 2: Commit the script**

```bash
git add scripts/benchmark.mjs
git commit -m "feat: add benchmark script for TS vs Rust server comparison"
```

---

### Task 3: Wire up npm script

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Read current scripts section in package.json**

Open `package.json`, find the `"scripts"` block.

- [ ] **Step 2: Add `bench` script**

In the `"scripts"` object, add after `"test:rust:smoke"`:

```json
"bench": "node scripts/benchmark.mjs",
```

- [ ] **Step 3: Verify the edit looks right**

```bash
node -e "const p = JSON.parse(require('fs').readFileSync('package.json','utf8')); console.log(p.scripts.bench)"
```

Expected: `node scripts/benchmark.mjs`

- [ ] **Step 4: Commit**

```bash
git add package.json
git commit -m "chore: add bench npm script"
```

---

### Task 4: Run the benchmark

- [ ] **Step 1: Ensure Rust binary is built**

```bash
ls server-rs/target/release/workbench-cli
```

If not found, run: `npm run build:rust` (takes ~2 minutes)

- [ ] **Step 2: Run the benchmark**

```bash
npm run bench
```

Expected: both servers start, autocannon progress bar appears twice, then a comparison table prints and `bench-results.json` is created.

- [ ] **Step 3: Verify bench-results.json was created**

```bash
cat bench-results.json
```

Expected: a JSON array with one entry containing `timestamp`, `typescript`, and `rust` keys.

- [ ] **Step 4: Commit results (optional)**

```bash
git add bench-results.json
git commit -m "chore: add initial benchmark results"
```
