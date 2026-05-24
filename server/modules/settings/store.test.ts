import { describe, it, expect } from "vitest";
import { createDatabase } from "../../db/index.js";
import { createSettingsStore } from "./store.js";

describe("SettingsStore", () => {
  it("returns fallback when key is missing", async () => {
    const database = createDatabase(":memory:");
    const store = createSettingsStore(database.db);
    expect(await store.get("missing", "default")).toBe("default");
  });

  it("reads and writes JSON values", async () => {
    const database = createDatabase(":memory:");
    const store = createSettingsStore(database.db);
    await store.set("test.number", 42);
    expect(await store.get("test.number", 0)).toBe(42);
    await store.set("test.number", 99);
    expect(await store.get("test.number", 0)).toBe(99);
  });

  it("lists keys by prefix", async () => {
    const database = createDatabase(":memory:");
    const store = createSettingsStore(database.db);
    await store.set("test.key", "value");
    await store.set("test.number", 99);
    const all = await store.getAll("test.");
    expect(all["test.key"]).toBe("value");
    expect(all["test.number"]).toBe(99);
  });
});
