#!/usr/bin/env node
import { createHash } from "node:crypto";
import { writeFileSync, existsSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const envFile = join(ROOT, ".env.local");

if (existsSync(envFile)) {
  const contents = (await import("node:fs")).readFileSync(envFile, "utf8");
  console.log(`.env.local already exists:\n${contents.trim()}`);
  process.exit(0);
}

// Derive a deterministic slot (0–49) from the worktree directory name.
// Each slot occupies 2 ports: Go on slot*2, Vite on slot*2+1.
// Go range: 4740–4838, Vite range: 5173–5271 — no overlap.
const slot = parseInt(createHash("md5").update(basename(ROOT)).digest("hex").slice(0, 4), 16) % 50;
const goPort = 4740 + slot * 2;
const vitePort = 5173 + slot * 2;

writeFileSync(envFile, `WORKBENCH_GO_PORT=${goPort}\nVITE_DEV_PORT=${vitePort}\n`);
console.log(`Worktree ports assigned:\n  Go API  → ${goPort}\n  Vite UI → ${vitePort}`);
