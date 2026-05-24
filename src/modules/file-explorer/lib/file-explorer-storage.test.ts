import { describe, expect, it } from "vitest";
import {
  ancestorDirectoryPaths,
  mergeExpandedPaths,
} from "./file-explorer-storage.js";

describe("file-explorer-storage", () => {
  it("returns ancestor directories for nested paths", () => {
    expect(ancestorDirectoryPaths("src/components/Button.vue")).toEqual([
      "src",
      "src/components",
    ]);
    expect(ancestorDirectoryPaths("README.md")).toEqual([]);
  });

  it("merges stored and required expanded paths", () => {
    expect(
      mergeExpandedPaths(["lib"], "src/app/main.ts"),
    ).toEqual(["lib", "src", "src/app"]);
  });
});
