/**
 * Append a dev version to docs/dev-versions.json (idempotent).
 *
 *   node scripts/register-dev-version.mjs 0.1.1-dev-abc1234
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const version = process.env.VERSION ?? process.argv[2];
if (!version) {
  console.error("Usage: register-dev-version.mjs <version>");
  process.exit(1);
}

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const indexPath = join(root, "docs", "dev-versions.json");
const versions = JSON.parse(readFileSync(indexPath, "utf8"));

if (!Array.isArray(versions)) {
  console.error(`${indexPath} must be a JSON array`);
  process.exit(1);
}

if (!versions.includes(version)) {
  versions.push(version);
  versions.sort();
  writeFileSync(indexPath, `${JSON.stringify(versions, null, 2)}\n`);
  console.log(`Registered ${version}`);
} else {
  console.log(`Already registered: ${version}`);
}
