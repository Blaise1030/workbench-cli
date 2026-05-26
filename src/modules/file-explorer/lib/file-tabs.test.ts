import { describe, expect, it } from "vitest";
import {
  adjacentFileAfterClose,
  basename,
  closeFileTab,
  openFileTab,
  pruneOpenFiles,
  seedOpenFiles,
} from "./file-tabs.js";

describe("file-tabs", () => {
  it("extracts basename from relative paths", () => {
    expect(basename("src/components/Button.tsx")).toBe("Button.tsx");
  });

  it("opens a tab without reordering existing tabs", () => {
    expect(openFileTab(["a.ts", "b.ts"], "a.ts")).toEqual(["a.ts", "b.ts"]);
    expect(openFileTab(["a.ts", "b.ts"], "c.ts")).toEqual(["a.ts", "b.ts", "c.ts"]);
    expect(openFileTab(undefined, "new.ts")).toEqual(["new.ts"]);
  });

  it("closes tabs and picks an adjacent file", () => {
    const tabs = ["a.ts", "b.ts", "c.ts"];
    expect(closeFileTab(tabs, "b.ts")).toEqual(["a.ts", "c.ts"]);
    expect(adjacentFileAfterClose(tabs, "b.ts")).toBe("c.ts");
    expect(adjacentFileAfterClose(tabs, "c.ts")).toBe("b.ts");
    expect(adjacentFileAfterClose(["only.ts"], "only.ts")).toBeNull();
  });

  it("seeds from last file when open list is empty", () => {
    expect(seedOpenFiles(undefined, "src/main.ts")).toEqual(["src/main.ts"]);
    expect(seedOpenFiles(["open.ts"], "src/main.ts")).toEqual(["open.ts"]);
  });

  it("prunes missing paths", () => {
    const kept = pruneOpenFiles(["a.ts", "gone.ts"], new Set(["a.ts", "b.ts"]));
    expect(kept).toEqual(["a.ts"]);
  });
});
