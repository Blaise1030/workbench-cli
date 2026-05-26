import { randomUUID } from "node:crypto";
import { createWriteStream } from "node:fs";
import { mkdir, readdir, stat, unlink } from "node:fs/promises";
import { homedir } from "node:os";
import { extname, join } from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";

/** Dropped files land at `~/.workbench/image/`. */
export function getWorkbenchImageDir(): string {
  return join(homedir(), ".workbench", "image");
}

/** Max size for a single dropped file (50 MB). */
export const DROP_ASSET_MAX_FILE_BYTES = 50 * 1024 * 1024;

/** Max total size of `~/.workbench/image` (512 MB). */
export const DROP_ASSET_MAX_DIR_BYTES = 512 * 1024 * 1024;

/** Delete assets older than this (7 days). */
export const DROP_ASSET_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export class DropAssetError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 413 = 400,
  ) {
    super(message);
    this.name = "DropAssetError";
  }
}

function safeExtension(originalName: string): string {
  const ext = extname(originalName).toLowerCase();
  if (/^\.[a-z0-9]{1,12}$/.test(ext)) return ext;
  return "";
}

async function writeUploadedFile(destPath: string, file: File): Promise<void> {
  if (file.size > DROP_ASSET_MAX_FILE_BYTES) {
    throw new DropAssetError(
      `File exceeds ${DROP_ASSET_MAX_FILE_BYTES} byte limit`,
      413,
    );
  }
  const stream = file.stream();
  const nodeStream = Readable.fromWeb(stream as import("node:stream/web").ReadableStream);
  await pipeline(nodeStream, createWriteStream(destPath));
}

type DirEntry = { path: string; size: number; mtimeMs: number };

async function listDirEntries(dir: string): Promise<DirEntry[]> {
  let names: string[];
  try {
    names = await readdir(dir);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }
  const entries: DirEntry[] = [];
  for (const name of names) {
    const path = join(dir, name);
    const info = await stat(path);
    if (!info.isFile()) continue;
    entries.push({ path, size: info.size, mtimeMs: info.mtimeMs });
  }
  return entries;
}

export type PruneDropAssetsOptions = {
  /** Override dir (tests only). */
  dir?: string;
  maxDirBytes?: number;
  maxAgeMs?: number;
};

/** Remove expired files, then oldest until under quota. */
export async function pruneWorkbenchImageDir(
  options?: PruneDropAssetsOptions,
): Promise<void> {
  const maxDirBytes = options?.maxDirBytes ?? DROP_ASSET_MAX_DIR_BYTES;
  const maxAgeMs = options?.maxAgeMs ?? DROP_ASSET_MAX_AGE_MS;
  const dir = options?.dir ?? getWorkbenchImageDir();
  const now = Date.now();
  const entries = await listDirEntries(dir);

  const toDelete = new Set<string>();
  for (const entry of entries) {
    if (now - entry.mtimeMs > maxAgeMs) toDelete.add(entry.path);
  }

  let remaining = entries.filter((e) => !toDelete.has(e.path));
  let total = remaining.reduce((sum, e) => sum + e.size, 0);

  if (total > maxDirBytes) {
    const byAge = [...remaining].sort((a, b) => a.mtimeMs - b.mtimeMs);
    for (const entry of byAge) {
      if (total <= maxDirBytes) break;
      toDelete.add(entry.path);
      total -= entry.size;
    }
  }

  await Promise.all([...toDelete].map((path) => unlink(path).catch(() => undefined)));
}

export type SaveDropAssetsOptions = {
  /** Override dir (tests only). */
  dir?: string;
};

export async function saveWorkbenchDropAssets(
  files: File[],
  options?: SaveDropAssetsOptions,
): Promise<string[]> {
  if (!files.length) return [];

  const dir = options?.dir ?? getWorkbenchImageDir();
  await mkdir(dir, { recursive: true });
  await pruneWorkbenchImageDir({ dir });

  const paths: string[] = [];
  for (const file of files) {
    const id = randomUUID();
    const dest = join(dir, `${id}${safeExtension(file.name)}`);
    await writeUploadedFile(dest, file);
    paths.push(dest);
  }

  await pruneWorkbenchImageDir({ dir });
  return paths;
}
