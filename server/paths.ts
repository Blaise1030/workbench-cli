import { existsSync } from "node:fs";
import { dirname, join } from "node:path";

/** Directory containing `cli/index.cjs` and `public/` (the shipped `dist/` tree). */
export function getDistDir(): string {
  const pkg = (process as NodeJS.Process & { pkg?: unknown }).pkg;
  if (pkg) {
    const nextToBinary = join(dirname(process.execPath), "dist");
    if (existsSync(join(nextToBinary, "public"))) return nextToBinary;
  }

  if (typeof __dirname === "string") {
    const fromBundle = join(__dirname, "..");
    if (existsSync(join(fromBundle, "public"))) return fromBundle;
  }

  const fromCwd = join(process.cwd(), "dist");
  if (existsSync(join(fromCwd, "public"))) return fromCwd;

  return fromCwd;
}

export function getPublicDir(): string {
  return join(getDistDir(), "public");
}
