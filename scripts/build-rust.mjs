/**
 * Build the Rust server with embedded UI (single native binary).
 *
 *   npm run build:rust
 *   node scripts/build-rust.mjs --skip-ui   # reuse existing dist/public
 */
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const serverRs = join(root, "server-rs");
const indexHtml = join(root, "dist/public/index.html");
const skipUi = process.argv.includes("--skip-ui");
const profile = process.argv.includes("--debug") ? "dev" : "release";
const cargoArgs = [
  "build",
  profile === "release" ? "--release" : "",
  "--features",
  "embed-assets",
]
  .filter(Boolean);

const pathWithCargo = `${join(homedir(), ".cargo/bin")}:${process.env.PATH ?? ""}`;

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

console.log(`Building Rust server (${profile}, embed-assets) …`);
execFileSync("cargo", cargoArgs, {
  cwd: serverRs,
  stdio: "inherit",
  env: { ...process.env, PATH: pathWithCargo },
});

const binary = join(
  serverRs,
  "target",
  profile,
  process.platform === "win32" ? "workbench-cli.exe" : "workbench-cli",
);

console.log(`\n  ✓ ${binary}\n`);
