import { describe, expect, it } from "vitest";
import { resolveExplorerPath } from "./resolve-code-context";

describe("resolveExplorerPath", () => {
  it("strips worktree prefix", () => {
    expect(
      resolveExplorerPath(
        "/proj",
        encodeURIComponent("/proj/src/foo.ts"),
      ),
    ).toBe("src/foo.ts");
  });

  it("returns null when path is outside worktree", () => {
    expect(
      resolveExplorerPath("/proj", encodeURIComponent("/other/foo.ts")),
    ).toBeNull();
  });
});
