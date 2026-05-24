import { eq, like } from "drizzle-orm";
import type { AppDatabase } from "../../db/index.js";
import { settings } from "../../db/schema.js";

export interface SettingsStore {
  get<T>(key: string, fallback: T): Promise<T>;
  set<T>(key: string, value: T): Promise<void>;
  getAll(prefix?: string): Promise<Record<string, unknown>>;
}

export function createSettingsStore(db: AppDatabase["db"]): SettingsStore {
  const cache = new Map<string, unknown>();

  return {
    async get<T>(key: string, fallback: T): Promise<T> {
      if (cache.has(key)) {
        return cache.get(key) as T;
      }
      const rows = await db.select().from(settings).where(eq(settings.key, key)).limit(1);
      const row = rows[0];
      if (!row) return fallback;
      try {
        const parsed = JSON.parse(row.value) as T;
        cache.set(key, parsed);
        return parsed;
      } catch {
        return fallback;
      }
    },

    async set<T>(key: string, value: T): Promise<void> {
      const encoded = JSON.stringify(value);
      const updatedAt = new Date();
      await db
        .insert(settings)
        .values({ key, value: encoded, updatedAt })
        .onConflictDoUpdate({
          target: settings.key,
          set: { value: encoded, updatedAt },
        });
      cache.set(key, value);
    },

    async getAll(prefix?: string): Promise<Record<string, unknown>> {
      const rows = prefix
        ? await db.select().from(settings).where(like(settings.key, `${prefix}%`))
        : await db.select().from(settings);
      const out: Record<string, unknown> = {};
      for (const row of rows) {
        try {
          out[row.key] = JSON.parse(row.value);
        } catch {
          out[row.key] = row.value;
        }
      }
      return out;
    },
  };
}
