/**
 * Write docs/latest.json for GitHub Pages install.sh
 *
 *   VERSION=0.1.0 node scripts/generate-latest-json.mjs
 *   GITHUB_REPOSITORY=owner/repo TAG=v0.1.0 node scripts/generate-latest-json.mjs
 */
import { writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outPath = join(root, "docs", "latest.json");

const repo = process.env.GITHUB_REPOSITORY ?? "Blaise1030/workbench-cli";
const tag = process.env.TAG ?? process.env.GITHUB_REF_NAME ?? "";
const version =
  process.env.VERSION ??
  (tag.startsWith("v") ? tag.slice(1) : tag) ??
  process.argv[2];

if (!version) {
  console.error("Set VERSION=… or TAG=v… (e.g. VERSION=0.1.0)");
  process.exit(1);
}

const releaseTag = tag || `v${version}`;
const base = `https://github.com/${repo}/releases/download/${releaseTag}`;

const assets = {
  "linux-x86_64": `${base}/workbench-cli-linux-x86_64.tar.gz`,
  "linux-aarch64": `${base}/workbench-cli-linux-aarch64.tar.gz`,
  "macos-x86_64": `${base}/workbench-cli-macos-x86_64.tar.gz`,
  "macos-aarch64": `${base}/workbench-cli-macos-aarch64.tar.gz`,
};

const manifest = { version, assets };
writeFileSync(outPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Wrote ${outPath} for ${releaseTag}`);
