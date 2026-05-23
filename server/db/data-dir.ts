import { homedir } from "node:os";
import { join } from "node:path";

export function getDataDir(): string {
  return join(homedir(), ".lan-terminal");
}

export function getDbPath(): string {
  return join(getDataDir(), "data.db");
}
