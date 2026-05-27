import { homedir } from "node:os";
import { join } from "node:path";

export function getDataDir(): string {
  return join(homedir(), ".workbench");
}

export function getDbPath(): string {
  return join(getDataDir(), "data.db");
}

export function getScrollbackDir(): string {
  return join(getDataDir(), "scrollback");
}

export function getScrollbackPreviousDir(): string {
  return join(getScrollbackDir(), "previous");
}
