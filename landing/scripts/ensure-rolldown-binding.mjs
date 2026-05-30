/**
 * pnpm may skip transitive optional @rolldown/binding-* on lockfile reinstall.
 * Install the native binding for the current OS/arch so `astro build` works in CI.
 */
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const landingRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

function bindingSpecifier() {
  if (process.platform === "darwin") {
    return process.arch === "arm64"
      ? "@rolldown/binding-darwin-arm64@1.0.2"
      : "@rolldown/binding-darwin-x64@1.0.2";
  }
  if (process.platform === "linux") {
    return process.arch === "arm64"
      ? "@rolldown/binding-linux-arm64-gnu@1.0.2"
      : "@rolldown/binding-linux-x64-gnu@1.0.2";
  }
  return null;
}

const specifier = bindingSpecifier();
if (!specifier) {
  process.exit(0);
}

const pkgName = specifier.slice(0, specifier.lastIndexOf("@"));
try {
  require.resolve(pkgName);
  process.exit(0);
} catch {
  // not installed
}

console.log(`Installing ${specifier} for astro/rolldown…`);
execFileSync("pnpm", ["install", specifier], {
  stdio: "inherit",
  cwd: landingRoot,
  env: { ...process.env, npm_config_save: "false" },
});
