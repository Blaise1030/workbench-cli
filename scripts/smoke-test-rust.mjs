/**
 * Smoke-test the Rust release binary (embedded UI + core API routes).
 *
 *   npm run test:rust:smoke
 *   node scripts/smoke-test-rust.mjs --debug   # use debug build
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const profile = process.argv.includes("--debug") ? "debug" : "release";
const port = Number(process.env.SMOKE_PORT ?? "4739");
const host = "127.0.0.1";
const base = `http://${host}:${port}`;
const binary = join(
  root,
  "server-rs/target",
  profile,
  process.platform === "win32" ? "workbench-cli.exe" : "workbench-cli",
);

if (!existsSync(binary)) {
  console.error(`Binary not found: ${binary}\nRun: npm run build:rust`);
  process.exit(1);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitForHealth(maxMs = 30_000) {
  const deadline = Date.now() + maxMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${base}/api/health`);
      if (res.ok) return res;
    } catch {
      /* server still starting */
    }
    await sleep(250);
  }
  throw new Error(`Server did not become ready on ${base} within ${maxMs}ms`);
}

function parseSetCookie(header) {
  if (!header) return "";
  const first = Array.isArray(header) ? header[0] : header.split(",")[0];
  return first.split(";")[0]?.trim() ?? "";
}

async function runChecks(cookie) {
  const checks = [];

  const health = await fetch(`${base}/api/health`);
  const healthJson = await health.json();
  checks.push({
    name: "GET /api/health",
    ok: health.ok && healthJson.ok === true && healthJson.server === "rust",
    detail: JSON.stringify(healthJson),
  });

  const index = await fetch(`${base}/`);
  const indexText = await index.text();
  checks.push({
    name: "GET / (embedded SPA)",
    ok:
      index.ok &&
      index.headers.get("content-type")?.includes("text/html") &&
      indexText.toLowerCase().includes("<html"),
    detail: `status=${index.status}, bytes=${indexText.length}`,
  });

  const assetPath = "/assets/";
  const assetRes = await fetch(`${base}/`);
  const html = await assetRes.text();
  const assetMatch = html.match(/\/assets\/[^"'\s]+/);
  if (assetMatch) {
    const asset = await fetch(`${base}${assetMatch[0]}`);
    checks.push({
      name: `GET ${assetMatch[0]}`,
      ok: asset.ok && (asset.headers.get("content-type")?.length ?? 0) > 0,
      detail: `status=${asset.status}`,
    });
  } else {
    checks.push({
      name: "GET /assets/* (from index.html)",
      ok: false,
      detail: "no asset URL found in index.html",
    });
  }

  const unauth = await fetch(`${base}/api/settings/lan`);
  checks.push({
    name: "GET /api/settings/lan (no session)",
    ok: unauth.status === 401,
    detail: `status=${unauth.status}`,
  });

  const authed = await fetch(`${base}/api/settings/lan`, {
    headers: cookie ? { Cookie: cookie } : {},
  });
  checks.push({
    name: "GET /api/settings/lan (with session)",
    ok: authed.ok,
    detail: `status=${authed.status}`,
  });

  const projects = await fetch(`${base}/api/projects`, {
    headers: cookie ? { Cookie: cookie } : {},
  });
  checks.push({
    name: "GET /api/projects (with session)",
    ok: projects.ok,
    detail: `status=${projects.status}`,
  });

  return checks;
}

const child = spawn(
  binary,
  ["--host", host, "--http", "-p", String(port), "-y"],
  {
    cwd: root,
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, PATH: `${join(homedir(), ".cargo/bin")}:${process.env.PATH ?? ""}` },
  },
);

child.stdout?.on("data", (chunk) => process.stdout.write(chunk));
child.stderr?.on("data", (chunk) => process.stderr.write(chunk));

let failed = false;

try {
  await waitForHealth();

  const authRes = await fetch(`${base}/api/auth/local`, { method: "POST" });
  const cookie = parseSetCookie(authRes.headers.get("set-cookie"));
  if (!authRes.ok || !cookie.startsWith("sid=")) {
    throw new Error(
      `POST /api/auth/local failed: status=${authRes.status}, cookie=${cookie || "(none)"}`,
    );
  }

  const checks = await runChecks(cookie);
  console.log("\nRust smoke test results:\n");
  for (const check of checks) {
    const mark = check.ok ? "✓" : "✗";
    console.log(`  ${mark} ${check.name} — ${check.detail}`);
    if (!check.ok) failed = true;
  }
  console.log(`\n  ✓ POST /api/auth/local — ${cookie.split("=")[0]}=…\n`);
} catch (err) {
  failed = true;
  console.error("\nSmoke test failed:", err.message ?? err);
} finally {
  child.kill("SIGTERM");
  await sleep(300);
  if (!child.killed) child.kill("SIGKILL");
}

process.exit(failed ? 1 : 0);
