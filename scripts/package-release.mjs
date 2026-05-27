/**
 * Build Herdr-style release archives: one folder (or .tar.gz) per platform.
 *
 *   npm run package:release              # requires Node 20+ on PATH
 *   npm run package:release:all          # embeds Node runtime (~50 MB extra)
 */
import {
  cpSync,
  chmodSync,
  createWriteStream,
  mkdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { execFileSync } from "node:child_process";
import { createGzip } from "node:zlib";
import { pipeline } from "node:stream/promises";
import { createReadStream } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { arch, platform } from "node:os";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const releaseRoot = join(root, "release");
const bundleNode = process.argv.includes("--bundle-node");

const PLATFORM_NAMES = {
  darwin: "macos",
  linux: "linux",
  win32: "windows",
};

function platformSlug() {
  const os = PLATFORM_NAMES[platform()] ?? platform();
  const cpu = arch() === "x64" ? "x86_64" : arch();
  return `${os}-${cpu}`;
}

function formatMb(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function dirSize(dir) {
  const kb = Number.parseInt(
    execFileSync("du", ["-sk", dir], { encoding: "utf8" }).trim().split("\t")[0],
    10,
  );
  return kb * 1024;
}

function tarGz(sourceDir, archivePath) {
  const tarPath = archivePath.replace(/\.tar\.gz$/, ".tar");
  execFileSync("tar", ["-cf", tarPath, "-C", dirname(sourceDir), basename(sourceDir)], {
    stdio: "inherit",
  });
  return new Promise((resolve, reject) => {
    const source = createReadStream(tarPath);
    const dest = createWriteStream(archivePath);
    const gzip = createGzip({ level: 9 });
    pipeline(source, gzip, dest)
      .then(() => {
        rmSync(tarPath, { force: true });
        resolve();
      })
      .catch(reject);
  });
}

async function maybeBundleNode(targetDir) {
  const nodeVersion = process.version.replace(/^v/, "");
  const slug = platformSlug();
  const [osName, cpu] = slug.split("-");
  const nodeOs = osName === "macos" ? "darwin" : osName;
  const nodeArch = cpu === "x86_64" ? "x64" : cpu;
  const base = `node-v${nodeVersion}-${nodeOs}-${nodeArch}`;
  const url = `https://nodejs.org/dist/v${nodeVersion}/${base}.tar.gz`;
  const cache = join(releaseRoot, ".cache");
  const cached = join(cache, `${base}.tar.gz`);
  mkdirSync(cache, { recursive: true });

  if (!statSync(cached, { throwIfNoEntry: false })) {
    console.log(`  Downloading Node ${nodeVersion} for ${slug}…`);
    execFileSync("curl", ["-fsSL", url, "-o", cached], { stdio: "inherit" });
  }

  const extractDir = join(cache, base);
  rmSync(extractDir, { recursive: true, force: true });
  execFileSync("tar", ["-xzf", cached, "-C", cache], { stdio: "inherit" });

  const nodeBin =
    osName === "windows"
      ? join(extractDir, "node.exe")
      : join(extractDir, "bin", "node");
  const dest = join(targetDir, "node", osName === "windows" ? "node.exe" : "bin", "node");
  mkdirSync(dirname(dest), { recursive: true });
  cpSync(nodeBin, dest);
  chmodSync(dest, 0o755);
}

function writeLauncher(targetDir, osName) {
  const isWin = osName === "windows";
  const name = isWin ? "workbench-cli.cmd" : "workbench-cli";
  const path = join(targetDir, name);

  if (isWin) {
    writeFileSync(
      path,
      `@echo off\r\nset ROOT=%~dp0\r\ncd /d "%ROOT%"\r\n` +
        (bundleNode
          ? '"%ROOT%node\\node.exe" "%ROOT%dist\\cli\\index.cjs" %*\r\n'
          : 'node "%ROOT%dist\\cli\\index.cjs" %*\r\n'),
      "utf8",
    );
    return;
  }

  const script = bundleNode
    ? `#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"
exec "$ROOT/node/bin/node" "$ROOT/dist/cli/index.cjs" "$@"
`
    : `#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"
if ! command -v node >/dev/null 2>&1; then
  echo "Node 20+ is required. Install from https://nodejs.org or download a --bundle-node release." >&2
  exit 1
fi
exec node "$ROOT/dist/cli/index.cjs" "$@"
`;
  writeFileSync(path, script, "utf8");
  chmodSync(path, 0o755);
}

async function main() {
  console.log("\n  Building workbench-cli release…\n");
  execFileSync("npm", ["run", "build"], { cwd: root, stdio: "inherit" });

  const slug = platformSlug();
  const folderName = `workbench-cli-${slug}`;
  const staging = join(releaseRoot, folderName);
  rmSync(staging, { recursive: true, force: true });
  mkdirSync(staging, { recursive: true });

  cpSync(join(root, "dist"), join(staging, "dist"), { recursive: true });

  const runtimePkg = {
    name: "workbench-cli-runtime",
    private: true,
    type: "module",
    dependencies: JSON.parse(readFileSync(join(root, "package.json"), "utf8")).dependencies,
  };
  writeFileSync(join(staging, "package.json"), JSON.stringify(runtimePkg, null, 2));
  execFileSync("npm", ["install", "--omit=dev", "--no-audit", "--no-fund"], {
    cwd: staging,
    stdio: "inherit",
  });
  rmSync(join(staging, "package.json"));
  rmSync(join(staging, "package-lock.json"), { force: true });

  const osName = slug.split("-")[0];
  writeLauncher(staging, osName);

  if (bundleNode) {
    console.log("  Embedding Node runtime…");
    await maybeBundleNode(staging);
  }

  mkdirSync(releaseRoot, { recursive: true });
  const archive = join(releaseRoot, `${folderName}.tar.gz`);
  await tarGz(staging, archive);

  const folderBytes = dirSize(staging);
  const archiveBytes = statSync(archive).size;
  console.log(`
  Release ready:
    Folder:   ${staging} (${formatMb(folderBytes)})
    Archive:  ${archive} (${formatMb(archiveBytes)})
    Launcher: ${join(staging, osName === "windows" ? "workbench-cli.cmd" : "workbench-cli")}
    Node:     ${bundleNode ? "bundled" : "system (20+)"}
`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
