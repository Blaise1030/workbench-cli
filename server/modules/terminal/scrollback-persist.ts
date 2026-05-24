import { copyFileSync, existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  getScrollbackDir,
  getScrollbackPreviousDir,
} from "../../db/data-dir.js";

export interface ScrollbackMeta {
  terminalId: string;
  cwd: string;
  lastActivity: number;
  exitCode: number | null;
}

function scrollbackPaths(terminalId: string, previous = false) {
  const base = previous ? getScrollbackPreviousDir() : getScrollbackDir();
  return {
    bin: join(base, `${terminalId}.bin`),
    meta: join(base, `${terminalId}.meta.json`),
  };
}

function ensureDirs(): void {
  mkdirSync(getScrollbackDir(), { recursive: true });
  mkdirSync(getScrollbackPreviousDir(), { recursive: true });
}

export function dumpScrollback(
  terminalId: string,
  data: Buffer,
  meta: Omit<ScrollbackMeta, "terminalId">,
): void {
  if (data.length === 0) return;
  ensureDirs();
  const payload: ScrollbackMeta = { terminalId, ...meta };
  const active = scrollbackPaths(terminalId, false);
  const previous = scrollbackPaths(terminalId, true);
  writeFileSync(active.bin, data);
  writeFileSync(active.meta, JSON.stringify(payload));
  copyFileSync(active.bin, previous.bin);
  copyFileSync(active.meta, previous.meta);
}

export function loadScrollback(terminalId: string): { data: Buffer; meta: ScrollbackMeta } | null {
  const { bin, meta: metaPath } = scrollbackPaths(terminalId, false);
  if (!existsSync(bin) || !existsSync(metaPath)) return null;
  try {
    const data = readFileSync(bin);
    const meta = JSON.parse(readFileSync(metaPath, "utf-8")) as ScrollbackMeta;
    if (meta.terminalId !== terminalId) return null;
    return { data, meta };
  } catch {
    return null;
  }
}

export function deleteScrollback(terminalId: string): void {
  for (const previous of [false, true]) {
    const { bin, meta } = scrollbackPaths(terminalId, previous);
    if (existsSync(bin)) unlinkSync(bin);
    if (existsSync(meta)) unlinkSync(meta);
  }
}

export function hasScrollbackDump(terminalId: string): boolean {
  const { bin, meta } = scrollbackPaths(terminalId, false);
  return existsSync(bin) && existsSync(meta);
}
