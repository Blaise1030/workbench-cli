/**
 * Write docs/latest.json for GitHub Pages install.sh
 *
 *   VERSION=0.1.0 node scripts/generate-latest-json.mjs
 *   GITHUB_REPOSITORY=owner/repo TAG=v0.1.0 node scripts/generate-latest-json.mjs
 *   TAG=workbench-v0.2.0 node scripts/generate-latest-json.mjs  # legacy Release Please tags
 */
import { writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outPath =
  process.env.OUTPUT_PATH ?? join(root, "docs", "latest.json");

const repo = process.env.GITHUB_REPOSITORY ?? "Blaise1030/workbench-cli";
const rawTag = process.env.TAG ?? process.env.GITHUB_REF_NAME ?? "";
const versionFromEnv = process.env.VERSION ?? process.argv[2];

/** @param {string} tag */
export function normalizeReleaseTag(tag) {
  const trimmed = tag.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("workbench-v")) return trimmed;
  if (trimmed.startsWith("v")) return trimmed;
  return `v${trimmed}`;
}

/** @param {string} tag */
export function versionFromTag(tag) {
  const releaseTag = normalizeReleaseTag(tag);
  return releaseTag.replace(/^(?:workbench-)?v/, "");
}

const releaseTag = normalizeReleaseTag(rawTag) || (versionFromEnv ? `v${versionFromEnv}` : "");
const version = versionFromEnv ?? (releaseTag ? versionFromTag(releaseTag) : "");

if (!version) {
  console.error("Set VERSION=… or TAG=v… (e.g. VERSION=0.1.0 or TAG=v0.1.0)");
  process.exit(1);
}

const resolvedTag = releaseTag || `v${version}`;
const base = `https://github.com/${repo}/releases/download/${resolvedTag}`;

const assets = {
  "linux-x86_64": `${base}/workbench-cli-linux-x86_64.tar.gz`,
  "linux-aarch64": `${base}/workbench-cli-linux-aarch64.tar.gz`,
  "macos-x86_64": `${base}/workbench-cli-macos-x86_64.tar.gz`,
  "macos-aarch64": `${base}/workbench-cli-macos-aarch64.tar.gz`,
};

const manifest = { version, assets };
writeFileSync(outPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Wrote ${outPath} for ${resolvedTag} (version ${version})`);
