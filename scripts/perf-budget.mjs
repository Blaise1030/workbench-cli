/**
 * Post-build performance budget check.
 * Measures gzip size of each JS/CSS chunk in dist/public/assets and fails
 * if any named chunk exceeds its budget or if total initial-load JS is too large.
 *
 * Run: node scripts/perf-budget.mjs
 * Or add after build: "build": "vite build ... && node scripts/perf-budget.mjs"
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const assetsDir = join(root, "dist/public/assets");

// Gzip budget per chunk prefix (bytes)
const CHUNK_BUDGETS = {
  "vendor-codemirror": 300 * 1024,
  "vendor-xterm":      150 * 1024,
  "vendor-vue":        100 * 1024,
  "vendor-pierre":     200 * 1024,
  "pierre-worker":      80 * 1024,
};

// All JS that ships on initial load (entry + non-lazy vendor chunks)
const INITIAL_LOAD_BUDGET = 500 * 1024;

// Per-file warn threshold — any single unlisted chunk over this triggers a warning
const PER_FILE_WARN = 100 * 1024;

function gzipSize(filePath) {
  return gzipSync(readFileSync(filePath)).length;
}

function kb(bytes) {
  return `${(bytes / 1024).toFixed(1)} KB`;
}

function matchBudget(name) {
  for (const [prefix, limit] of Object.entries(CHUNK_BUDGETS)) {
    if (name.startsWith(prefix)) return { prefix, limit };
  }
  return null;
}

let failed = false;

const jsFiles = readdirSync(assetsDir)
  .filter((f) => f.endsWith(".js"))
  .sort();

console.log("\nPerformance Budget Report\n" + "─".repeat(52));

let initialLoadTotal = 0;
const rows = [];

for (const file of jsFiles) {
  const filePath = join(assetsDir, file);
  const raw = statSync(filePath).size;
  const gz = gzipSize(filePath);

  const budget = matchBudget(file);

  let status = "  ";
  if (budget) {
    if (gz > budget.limit) {
      status = "✗ OVER BUDGET";
      failed = true;
    } else {
      status = "✓";
    }
  } else if (gz > PER_FILE_WARN) {
    status = "⚠ large";
  }

  // Count entry chunks and named vendor chunks toward initial load
  const isInitial = file.startsWith("index-") || file.startsWith("vendor-");
  if (isInitial) initialLoadTotal += gz;

  rows.push({
    file,
    raw,
    gz,
    budget: budget ? budget.limit : null,
    status,
    isInitial,
  });
}

for (const r of rows) {
  const budgetStr = r.budget ? ` / ${kb(r.budget)}` : "";
  console.log(`${r.status.padEnd(15)} ${r.file.padEnd(40)} ${kb(r.gz).padStart(9)}${budgetStr}`);
}

console.log("─".repeat(52));

const initialStatus = initialLoadTotal > INITIAL_LOAD_BUDGET ? "✗ OVER" : "✓";
if (initialLoadTotal > INITIAL_LOAD_BUDGET) failed = true;

console.log(
  `${initialStatus} Initial JS load (gzip): ${kb(initialLoadTotal)} / ${kb(INITIAL_LOAD_BUDGET)}`
);

// CSS total (informational)
const cssFiles = readdirSync(assetsDir).filter((f) => f.endsWith(".css"));
const cssTotal = cssFiles.reduce((sum, f) => sum + gzipSize(join(assetsDir, f)), 0);
console.log(`   CSS total (gzip):      ${kb(cssTotal)}`);

console.log("");

if (failed) {
  console.error("Budget check FAILED — reduce bundle size before shipping.\n");
  process.exit(1);
} else {
  console.log("Budget check passed.\n");
}
