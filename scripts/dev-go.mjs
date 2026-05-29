#!/usr/bin/env node
/**
 * Dev with Go API + Vite HMR (same idea as server/index.ts + Vite middlewareMode).
 *
 * Open the Vite URL (default :5173) — not the Go port. Go serves API/WS only in this mode.
 */

import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const GO_PORT = process.env.WORKBENCH_GO_PORT ?? "4740";
const VITE_PORT = process.env.VITE_DEV_PORT ?? "5173";

const children = [];

function run(cmd, args, opts = {}) {
  const child = spawn(cmd, args, {
    cwd: opts.cwd ?? ROOT,
    stdio: "inherit",
    env: { ...process.env, ...opts.env },
  });
  children.push(child);
  return child;
}

async function waitForHealth() {
  const url = `http://127.0.0.1:${GO_PORT}/api/health`;
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      /* not ready */
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`Go server did not become ready at ${url}`);
}

function shutdown(code = 0) {
  for (const child of children) {
    if (!child.killed) child.kill("SIGTERM");
  }
  process.exit(code);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

const go = run(
  "go",
  ["run", "./cmd/workbench-cli", "--http", "-p", GO_PORT, "-y"],
  { cwd: join(ROOT, "server-go") },
);

go.on("exit", (code, signal) => {
  if (signal === "SIGTERM" || signal === "SIGINT") return;
  if (code !== 0 && code !== null) {
    console.error(`Go server exited with code ${code}`);
    shutdown(code ?? 1);
  }
});

try {
  await waitForHealth();
} catch (err) {
  console.error(err.message);
  shutdown(1);
}

const vite = run("npx", ["vite", "--config", "frontend/vite.config.ts"], {
  env: {
    WORKBENCH_DEV_BACKEND: "go",
    WORKBENCH_GO_PORT: GO_PORT,
    VITE_DEV_PORT: VITE_PORT,
  },
});

vite.on("exit", (code) => shutdown(code ?? 0));

console.log(`
  UI (HMR)  → http://127.0.0.1:${VITE_PORT}
  API (Go)  → http://127.0.0.1:${GO_PORT}  (/api, /ws proxied by Vite)
`);
