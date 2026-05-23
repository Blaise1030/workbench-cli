import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { getDbPath, getDataDir } from "./data-dir.js";
import { runMigrations } from "./migrate.js";
import * as schema from "./schema.js";

export type AppDatabase = ReturnType<typeof createDatabase>;

export function createDatabase(dbPath = getDbPath()) {
  if (dbPath !== ":memory:") {
    mkdirSync(getDataDir(), { recursive: true });
    mkdirSync(dirname(dbPath), { recursive: true });
  }

  const sqlite = new Database(dbPath);
  runMigrations(sqlite);
  const db = drizzle(sqlite, { schema });
  return { db, sqlite, dbPath };
}

export { schema };
