/**
 * Build workbench-cli and install to PATH.
 *
 *   npm run install:go              # ~/.local/bin (no sudo)
 *   npm run install:go:global       # /usr/local/bin (sudo)
 *   node scripts/install-go-local.mjs --skip-ui --global
 */
import { chmodSync, copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { execFileSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const buildScript = join(root, "scripts/build-go.mjs");
const srcBinary = join(root, "bin/workbench-cli");
const global = process.argv.includes("--global");
const passthrough = process.argv.filter((a) => a !== "--global");

const installDir = global ? "/usr/local/bin" : join(homedir(), ".local/bin");
const destBinary = join(installDir, "workbench-cli");
const pathSnippet = 'export PATH="$HOME/.local/bin:$PATH"';

execFileSync(process.execPath, [buildScript, ...passthrough.slice(2)], {
  cwd: root,
  stdio: "inherit",
});

if (global) {
  execFileSync("sudo", ["install", "-m", "755", srcBinary, destBinary], { stdio: "inherit" });
} else {
  mkdirSync(installDir, { recursive: true });
  copyFileSync(srcBinary, destBinary);
  chmodSync(destBinary, 0o755);
}

console.log(`Installed → ${destBinary}`);

if (global) {
  console.log("\n/usr/local/bin is on the default macOS PATH for all terminals.");
} else {
  const shell = process.env.SHELL ?? "";
  const rcFiles = [];
  if (shell.includes("zsh")) rcFiles.push(join(homedir(), ".zshrc"));
  if (shell.includes("bash")) rcFiles.push(join(homedir(), ".bashrc"));
  rcFiles.push(join(homedir(), ".profile"));

  let pathConfigured = (process.env.PATH ?? "").split(":").includes(installDir);
  for (const rc of rcFiles) {
    if (!existsSync(rc)) continue;
    const text = readFileSync(rc, "utf8");
    if (text.includes(".local/bin")) {
      pathConfigured = true;
      break;
    }
  }

  if (!pathConfigured) {
    const rc = rcFiles.find((f) => existsSync(f)) ?? join(homedir(), ".zshrc");
    const prefix = existsSync(rc) ? "\n" : "";
    writeFileSync(rc, `${prefix}# workbench-cli\n${pathSnippet}\n`, { flag: "a" });
    console.log(`\nAdded ${installDir} to PATH in ${rc}`);
    console.log("Run: source " + rc + "   (or open a new terminal)");
  } else {
    console.log("\n~/.local/bin is already on your PATH");
  }
}

console.log("\nTry:\n  workbench-cli --http\n");
