/**
 * Write versioned install.sh + latest.json for GitHub Pages.
 *
 *   VERSION=0.1.1-dev-abc1234 TAG=v0.1.1-dev-abc1234 \
 *     node scripts/prepare-versioned-install.mjs
 *
 *   OUT_DIR=landing/dist/0.1.1-dev-abc1234 \
 *     MANIFEST_BASE=https://blaise1030.github.io/workbench-cli/0.1.1-dev-abc1234 \
 *     node scripts/prepare-versioned-install.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const version = process.env.VERSION ?? process.argv[2] ?? "";
const tag =
  process.env.TAG ??
  process.env.GITHUB_REF_NAME ??
  (version ? `v${version}` : "");
const outDir =
  process.env.OUT_DIR ?? join(root, "landing", "dist", version ?? "");
const pagesBase =
  process.env.PAGES_BASE ?? "https://blaise1030.github.io/workbench-cli";
const manifestBase = process.env.MANIFEST_BASE ?? `${pagesBase}/${version}`;

if (!version || !tag) {
  console.error("Set VERSION=… and TAG=v… (or pass VERSION as argv[2])");
  process.exit(1);
}

mkdirSync(outDir, { recursive: true });

const gen = spawnSync(
  process.execPath,
  ["scripts/generate-latest-json.mjs"],
  {
    cwd: root,
    env: {
      ...process.env,
      VERSION: version,
      TAG: tag,
      OUTPUT_PATH: join(outDir, "latest.json"),
    },
    stdio: "inherit",
  },
);
if (gen.status !== 0) process.exit(gen.status ?? 1);

const template = readFileSync(join(root, "docs", "install.sh"), "utf8");
const manifestUrl = `${manifestBase.replace(/\/$/, "")}/latest.json`;
const installSh = template.replace(
  /MANIFEST_URL="\$\{WORKBENCH_MANIFEST_URL:-[^"]+\}"/,
  `MANIFEST_URL="\${WORKBENCH_MANIFEST_URL:-${manifestUrl}}"`,
);

writeFileSync(join(outDir, "install.sh"), installSh, { mode: 0o755 });
console.log(`Wrote ${join(outDir, "install.sh")} → ${manifestUrl}`);
