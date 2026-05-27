import { open, readdir, stat, writeFile } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import { assertPathWithinRoot } from "./path-guard.js";

export const MAX_FILE_PREVIEW_BYTES = 512 * 1024;

export class FileReadError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 404 | 413,
  ) {
    super(message);
    this.name = "FileReadError";
  }
}

const NOISE_DIRS = new Set([
  "node_modules",
  ".git",
  ".next",
  "dist",
  ".turbo",
  ".cache",
  "__pycache__",
  ".venv",
  ".DS_Store",
]);

export async function listFilesForWorktree(worktreePath: string): Promise<string[]> {
  const paths: string[] = [];

  async function walk(dir: string): Promise<void> {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (NOISE_DIRS.has(entry.name)) continue;
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
      } else {
        const rel = relative(worktreePath, fullPath);
        paths.push(rel.split(sep).join("/"));
      }
    }
  }

  await walk(worktreePath);
  return paths;
}

export async function readFileForWorktree(
  worktreePath: string,
  relativePath: string,
): Promise<{ path: string; content: string; truncated: boolean }> {
  const normalized = relativePath.replace(/\\/g, "/").replace(/^\/+/, "");
  if (!normalized || normalized.endsWith("/")) {
    throw new FileReadError("Invalid file path", 400);
  }

  const absolutePath = assertPathWithinRoot(worktreePath, normalized);

  let fileStat;
  try {
    fileStat = await stat(absolutePath);
  } catch {
    throw new FileReadError("File not found", 404);
  }

  if (!fileStat.isFile()) {
    throw new FileReadError("Not a file", 400);
  }

  const truncated = fileStat.size > MAX_FILE_PREVIEW_BYTES;
  const readLength = truncated ? MAX_FILE_PREVIEW_BYTES : fileStat.size;

  const handle = await open(absolutePath, "r");
  try {
    const buf = Buffer.alloc(readLength);
    const { bytesRead } = await handle.read(buf, 0, readLength, 0);
    const slice = buf.subarray(0, bytesRead);
    if (slice.includes(0)) {
      throw new FileReadError("Binary file cannot be previewed", 400);
    }
    return {
      path: normalized,
      content: slice.toString("utf8"),
      truncated,
    };
  } finally {
    await handle.close();
  }
}

export async function writeFileForWorktree(
  worktreePath: string,
  relativePath: string,
  content: string,
): Promise<void> {
  const normalized = relativePath.replace(/\\/g, "/").replace(/^\/+/, "");
  if (!normalized || normalized.endsWith("/")) {
    throw new FileReadError("Invalid file path", 400);
  }

  const absolutePath = assertPathWithinRoot(worktreePath, normalized);

  let fileStat;
  try {
    fileStat = await stat(absolutePath);
  } catch {
    throw new FileReadError("File not found", 404);
  }

  if (!fileStat.isFile()) {
    throw new FileReadError("Not a file", 400);
  }

  await writeFile(absolutePath, content, "utf-8");
}
