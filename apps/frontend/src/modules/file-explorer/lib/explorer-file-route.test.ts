import { describe, expect, it } from "vitest";
import { explorerFileRoute, worktreeFilePath } from "./explorer-file-route.js";

describe("explorer-file-route", () => {
  it("builds full paths without duplicate slashes", () => {
    expect(worktreeFilePath("/repo", "src/main.ts")).toBe("/repo/src/main.ts");
    expect(worktreeFilePath("/repo/", "src/main.ts")).toBe("/repo/src/main.ts");
  });

  it("builds explorer routes with encoded file query", () => {
    expect(
      explorerFileRoute("wt-1", "/repo", "src/main.ts"),
    ).toEqual({
      name: "explorer",
      params: { worktreeId: "wt-1" },
      query: { file: encodeURIComponent("/repo/src/main.ts") },
    });
  });
});
