#!/usr/bin/env node
/**
 * Benchmark: measures req/s on /api/health for both TypeScript (Hono) and Go servers.
 * Writes bench-results.json with { typescript, go } keys.
 */

import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const GO_BINARY = join(ROOT, "bin", "workbench-cli");

const TS_PORT = 4742;
const GO_PORT = 4743;
const DURATION_SECS = 10;
const CONNECTIONS = 10;
const POLL_MS = 300;
const TIMEOUT_MS = 20_000;

async function poll(url, maxMs) {
  const deadline = Date.now() + maxMs;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(url);
      if (r.ok) return true;
    } catch { /* not ready */ }
    await new Promise(r => setTimeout(r, POLL_MS));
  }
  return false;
}

function spawnServer(cmd, args, env) {
  const proc = spawn(cmd, args, { env: { ...process.env, ...env }, stdio: ["ignore", "pipe", "pipe"] });
  proc.stdout.on("data", () => {});
  proc.stderr.on("data", () => {});
  return proc;
}

async function runAutocannon(url) {
  return new Promise((resolve, reject) => {
    let output = "";
    const proc = spawn("node", [
      "-e",
      `const autocannon = require('autocannon');
       autocannon({ url: '${url}', connections: ${CONNECTIONS}, duration: ${DURATION_SECS} }, (err, result) => {
         if (err) { process.stderr.write(err.message); process.exit(1); }
         process.stdout.write(JSON.stringify({
           requests: result.requests.average,
           latency: result.latency.average,
           throughput: result.throughput.average,
         }));
       });`,
    ], { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"] });
    proc.stdout.on("data", d => output += d.toString());
    proc.stderr.on("data", d => process.stderr.write(d));
    proc.on("close", code => {
      if (code !== 0) return reject(new Error(`autocannon exited ${code}`));
      try { resolve(JSON.parse(output)); } catch (e) { reject(e); }
    });
  });
}

// Start servers
console.log("Starting servers...");
const tsProc = spawnServer("node", ["node_modules/.bin/tsx", "server/index.ts"], {
  PORT: String(TS_PORT), WORKBENCH_HOST: "127.0.0.1",
});
const goProc = spawnServer(GO_BINARY, ["--http", `-p`, String(GO_PORT), "-y"], {});

let results = { typescript: null, go: null };

try {
  const [tsReady, goReady] = await Promise.all([
    poll(`http://127.0.0.1:${TS_PORT}/api/health`, TIMEOUT_MS),
    poll(`http://127.0.0.1:${GO_PORT}/api/health`, TIMEOUT_MS),
  ]);
  if (!tsReady) throw new Error("TypeScript server failed to start");
  if (!goReady) throw new Error("Go server failed to start");
  console.log("Both servers ready. Running benchmarks...\n");

  console.log(`Benchmarking TypeScript (${DURATION_SECS}s)...`);
  results.typescript = await runAutocannon(`http://127.0.0.1:${TS_PORT}/api/health`);
  console.log(`  req/s: ${results.typescript.requests.toFixed(0)}, latency: ${results.typescript.latency.toFixed(2)}ms`);

  console.log(`Benchmarking Go (${DURATION_SECS}s)...`);
  results.go = await runAutocannon(`http://127.0.0.1:${GO_PORT}/api/health`);
  console.log(`  req/s: ${results.go.requests.toFixed(0)}, latency: ${results.go.latency.toFixed(2)}ms`);

  console.log("\n=== Results ===");
  console.log(`TypeScript: ${results.typescript.requests.toFixed(0)} req/s`);
  console.log(`Go:         ${results.go.requests.toFixed(0)} req/s`);
  const ratio = results.go.requests / results.typescript.requests;
  console.log(`Go is ${ratio.toFixed(2)}x ${ratio >= 1 ? "faster" : "slower"} than TypeScript`);

  writeFileSync(join(ROOT, "bench-results.json"), JSON.stringify(results, null, 2));
  console.log("\nResults written to bench-results.json");
} finally {
  tsProc.kill("SIGTERM");
  goProc.kill("SIGTERM");
}
