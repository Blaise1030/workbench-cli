import { createHash } from "node:crypto";
import { readFileSync, readdirSync, realpathSync, statSync } from "node:fs";
import { basename, join } from "node:path";

export function normalizeCwd(cwd: string): string {
  try {
    return realpathSync(cwd);
  } catch {
    return cwd;
  }
}

export function cursorWorkspaceHash(cwd: string): string {
  return createHash("md5").update(normalizeCwd(cwd)).digest("hex");
}

export function geminiProjectHash(cwd: string): string {
  return createHash("sha256").update(normalizeCwd(cwd)).digest("hex");
}

export function newestByMtime<T extends { mtimeMs: number }>(items: T[]): T | null {
  if (items.length === 0) return null;
  return items.reduce((best, item) => (item.mtimeMs > best.mtimeMs ? item : best));
}

export function readFirstJsonLine(path: string): Record<string, unknown> | null {
  try {
    const head = readFileSync(path, "utf-8").split("\n")[0]?.trim();
    if (!head) return null;
    return JSON.parse(head) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function sessionIdFromGeminiFile(path: string): string | null {
  const meta = readFirstJsonLine(path);
  const sessionId = meta?.sessionId;
  if (typeof sessionId === "string" && sessionId.length > 0) return sessionId;

  const base = basename(path).replace(/\.(jsonl?|json)$/, "");
  const match = base.match(
    /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i,
  );
  return match?.[1] ?? null;
}

export function walkFiles(root: string, filter: (name: string) => boolean): string[] {
  const files: string[] = [];
  const stack = [root];
  while (stack.length > 0) {
    const dir = stack.pop()!;
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      continue;
    }
    for (const name of entries) {
      const full = join(dir, name);
      let st;
      try {
        st = statSync(full);
      } catch {
        continue;
      }
      if (st.isDirectory()) {
        stack.push(full);
      } else if (filter(name)) {
        files.push(full);
      }
    }
  }
  return files;
}

export function isGeminiSessionFile(name: string): boolean {
  return /^session-.*\.(jsonl?|json)$/.test(name);
}

export function isCursorStoreDb(name: string): boolean {
  return name === "store.db";
}
