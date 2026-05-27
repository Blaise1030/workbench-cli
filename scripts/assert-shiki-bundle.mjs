/**
 * Post-build guard: only allowlisted Shiki language chunks ship in dist/public.
 */
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const assetsDir = join(root, "dist/public/assets");
const allowlistSource = readFileSync(
  join(root, "src/shared/lib/pierre-shiki-langs.ts"),
  "utf8",
);

const arrayMatch = allowlistSource.match(
  /PIERRE_SHIKI_LANG_IDS\s*=\s*\[([\s\S]*?)\]\s*as const/,
);
if (!arrayMatch) {
  console.error("Could not parse PIERRE_SHIKI_LANG_IDS from pierre-shiki-langs.ts");
  process.exit(1);
}

const allowed = new Set([...arrayMatch[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]));

const vendorPrefixes = ["vendor-", "index-", "worker-", "shiki-wasm"];

const files = readdirSync(assetsDir).filter((f) => f.endsWith(".js"));
const langChunks = files.filter(
  (f) => !vendorPrefixes.some((p) => f.startsWith(p)),
);

const unexpected = langChunks.filter((file) => {
  const id = file.replace(/-[a-zA-Z0-9_-]+\.js$/, "");
  return !allowed.has(id);
});

if (unexpected.length > 0) {
  console.error(
    `Unexpected Shiki language chunks (${unexpected.length}): ${unexpected.join(", ")}`,
  );
  console.error(`Allowed (${allowed.size}): ${[...allowed].join(", ")}`);
  process.exit(1);
}

console.log(
  `  Shiki bundle OK: ${langChunks.length} language chunk(s), allowlist ${allowed.size}`,
);
