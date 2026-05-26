import { afterEach, describe, expect, it } from "vitest";
import {
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  stat,
  utimes,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  DROP_ASSET_MAX_AGE_MS,
  pruneWorkbenchImageDir,
  saveWorkbenchDropAssets,
} from "./drop-assets.js";

async function tempImageDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), "workbench-image-"));
}

describe("saveWorkbenchDropAssets", () => {
  let dir: string;

  afterEach(async () => {
    if (dir) await rm(dir, { recursive: true, force: true });
  });

  it("writes under the image dir and returns absolute paths", async () => {
    dir = await tempImageDir();
    const file = new File(["hello"], "photo.png", { type: "image/png" });
    const paths = await saveWorkbenchDropAssets([file], { dir });
    expect(paths).toHaveLength(1);
    expect(paths[0]).toMatch(/[0-9a-f-]{36}\.png$/);
    expect(paths[0]!.startsWith(dir)).toBe(true);
    const content = await readFile(paths[0]!, "utf8");
    expect(content).toBe("hello");
  });
});

describe("pruneWorkbenchImageDir", () => {
  let dir: string;

  afterEach(async () => {
    if (dir) await rm(dir, { recursive: true, force: true });
  });

  it("deletes files older than max age", async () => {
    dir = await tempImageDir();
    await mkdir(dir, { recursive: true });
    const oldFile = join(dir, "old.txt");
    await writeFile(oldFile, "x");
    const oldTime = new Date(Date.now() - DROP_ASSET_MAX_AGE_MS - 1000);
    await utimes(oldFile, oldTime, oldTime);
    await pruneWorkbenchImageDir({ dir });
    await expect(stat(oldFile)).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("deletes oldest files when over dir quota", async () => {
    dir = await tempImageDir();
    await mkdir(dir, { recursive: true });
    const maxDirBytes = 3000;
    await writeFile(join(dir, "a.bin"), "a".repeat(1200));
    await writeFile(join(dir, "b.bin"), "b".repeat(1200));
    await writeFile(join(dir, "c.bin"), "c".repeat(1200));
    await utimes(join(dir, "a.bin"), new Date(1), new Date(1));
    await utimes(join(dir, "b.bin"), new Date(2), new Date(2));
    await utimes(join(dir, "c.bin"), new Date(3), new Date(3));
    await pruneWorkbenchImageDir({ dir, maxDirBytes, maxAgeMs: DROP_ASSET_MAX_AGE_MS });
    const remaining = await readdir(dir);
    const total = (
      await Promise.all(remaining.map((name) => stat(join(dir, name))))
    ).reduce((sum, info) => sum + info.size, 0);
    expect(total).toBeLessThanOrEqual(maxDirBytes);
    expect(remaining.length).toBeLessThan(3);
  });
});
