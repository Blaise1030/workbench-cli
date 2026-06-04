#!/usr/bin/env node
/**
 * Dev with Go API + Vite HMR (same idea as server/index.ts + Vite middlewareMode).
 *
 * Open the Vite URL (default :5173) — not the Go port. Go serves API/WS only in this mode.
 */

import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { goMissingMessage, resolveGoBin } from "./go-bin.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_GO_PORT = 4740;
const DEFAULT_VITE_PORT = 5173;
const requestedGoPort = Number(process.env.WORKBENCH_GO_PORT ?? DEFAULT_GO_PORT);
const requestedVitePort = Number(process.env.VITE_DEV_PORT ?? DEFAULT_VITE_PORT);
const GO_BIN = resolveGoBin();
const GO_START_TIMEOUT_MS = Number(process.env.WORKBENCH_GO_START_TIMEOUT_MS ?? "120000");

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

function isPortAvailableOnHost(port, host) {
  return new Promise((resolve) => {
    const server = createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    server.listen(port, host);
  });
}

async function isPortAvailable(port) {
  const checks = await Promise.all([
    isPortAvailableOnHost(port, "127.0.0.1"),
    isPortAvailableOnHost(port, "::1"),
  ]);
  return checks.every(Boolean);
}

async function resolvePort(requestedPort, envName) {
  if (process.env[envName]) return String(requestedPort);

  let port = requestedPort;
  while (!(await isPortAvailable(port))) {
    port += 1;
  }
  return String(port);
}

async function waitForHealth() {
  const url = `http://127.0.0.1:${GO_PORT}/api/health`;
  const deadline = Date.now() + GO_START_TIMEOUT_MS;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      /* not ready */
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`Go server did not become ready at ${url} within ${GO_START_TIMEOUT_MS}ms`);
}

function shutdown(code = 0) {
  for (const child of children) {
    if (!child.killed) child.kill("SIGTERM");
  }
  process.exit(code);
}

if (!GO_BIN) {
  console.error(goMissingMessage());
  process.exit(1);
}

const GO_PORT = await resolvePort(requestedGoPort, "WORKBENCH_GO_PORT");
const VITE_PORT = await resolvePort(requestedVitePort, "VITE_DEV_PORT");

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

const go = run(
  GO_BIN,
  ["run", "./cmd/workbench-cli", "--http", "-p", GO_PORT, "-y"],
  {
    cwd: join(ROOT, "server-go"),
    env: { WORKBENCH_DEV_UI_PORT: VITE_PORT },
  },
);

go.on("error", (err) => {
  console.error(`Failed to start Go server: ${err.message}`);
  shutdown(1);
});

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
