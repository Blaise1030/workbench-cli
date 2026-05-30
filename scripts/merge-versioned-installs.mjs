/**
 * Copy published dev install folders into the Astro dist output.
 * Reads docs/dev-versions.json and hydrates each version from the live site
 * (when present), then writes the current build from OUT_DIR when VERSION matches.
 */
import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  copyFileSync,
  existsSync,
} from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const distDir = process.argv[2] ?? join(root, "landing", "dist");
const indexPath = join(root, "docs", "dev-versions.json");
const pagesBase =
  process.env.PAGES_BASE ?? "https://blaise1030.github.io/workbench-cli";

const versions = JSON.parse(readFileSync(indexPath, "utf8"));
if (!Array.isArray(versions)) {
  console.error(`${indexPath} must be a JSON array of version strings`);
  process.exit(1);
}

const freshVersion = process.env.VERSION?.trim();
const freshDir = process.env.OUT_DIR?.trim();

mkdirSync(distDir, { recursive: true });

async function fetchText(url) {
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) return null;
  return res.text();
}

for (const version of versions) {
  const dest = join(distDir, version);
  mkdirSync(dest, { recursive: true });

  if (freshVersion === version && freshDir && existsSync(join(freshDir, "install.sh"))) {
    copyFileSync(join(freshDir, "install.sh"), join(dest, "install.sh"));
    copyFileSync(join(freshDir, "latest.json"), join(dest, "latest.json"));
    console.log(`Wrote ${version} from build output`);
    continue;
  }

  const install = await fetchText(`${pagesBase}/${version}/install.sh`);
  const manifest = await fetchText(`${pagesBase}/${version}/latest.json`);
  if (install && manifest) {
    writeFileSync(join(dest, "install.sh"), install);
    writeFileSync(join(dest, "latest.json"), manifest);
    console.log(`Hydrated ${version} from ${pagesBase}`);
  } else {
    console.log(`Skip ${version} (not on Pages yet)`);
  }
}
