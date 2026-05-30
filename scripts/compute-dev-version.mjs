/**
 * Print dev release version: {packageVersion}-dev-{shortSha}
 *
 *   node scripts/compute-dev-version.mjs
 *   GITHUB_SHA=abc... node scripts/compute-dev-version.mjs
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const sha = (process.env.GITHUB_SHA ?? "local").slice(0, 7);
const version = `${pkg.version}-dev-${sha}`;

process.stdout.write(version);
