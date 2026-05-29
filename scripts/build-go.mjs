/**
 * Build the Go server with embedded UI (single native binary).
 *
 *   npm run build:go
 *   node scripts/build-go.mjs --skip-ui   # reuse existing dist/public
 */
import { execFileSync } from "node:child_process";
import { chmodSync, cpSync, existsSync, mkdirSync, rmSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const serverGo = join(root, "server-go");
const indexHtml = join(root, "dist/public/index.html");
const embedPublic = join(serverGo, "internal/assets/public");
const outBinary = join(root, "bin", "workbench-cli");
const skipUi = process.argv.includes("--skip-ui");

if (!skipUi) {
  if (!existsSync(indexHtml)) {
    console.log("Building UI → dist/public …");
  } else {
    console.log("Refreshing UI → dist/public …");
  }
  execFileSync("npm", ["run", "build"], { cwd: root, stdio: "inherit" });
} else if (!existsSync(indexHtml)) {
  console.error("dist/public/index.html missing. Run `npm run build` or drop --skip-ui.");
  process.exit(1);
}

console.log("Staging UI for go:embed …");
rmSync(embedPublic, { recursive: true, force: true });
mkdirSync(embedPublic, { recursive: true });
cpSync(join(root, "dist/public"), embedPublic, { recursive: true });

mkdirSync(join(root, "bin"), { recursive: true });

console.log("Building Go server (embed, stripped) …");
execFileSync(
  "go",
  [
    "build",
    "-tags",
    "embed",
    `-ldflags=-s -w`,
    "-o",
    outBinary,
    "./cmd/workbench-cli",
  ],
  { cwd: serverGo, stdio: "inherit" },
);

chmodSync(outBinary, 0o755);
const sizeMb = (statSync(outBinary).size / 1024 / 1024).toFixed(1);
console.log(`\n  ✓ ${outBinary} (${sizeMb} MB)\n`);
