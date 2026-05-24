import { afterEach, describe, expect, it } from "vitest";
import {
  clearDragPayload,
  fileUrlToPath,
  formatPathsForTerminal,
  pathFromDropLine,
  pathsFromDataTransfer,
  resolveBasenameInFileTree,
  resolveRelativeToWorktreeRoot,
  shellQuotePath,
} from "./terminal-drop.js";

describe("fileUrlToPath", () => {
  it("decodes file URLs", () => {
    expect(fileUrlToPath("file:///Users/me/foo.txt")).toBe("/Users/me/foo.txt");
  });
});

describe("shellQuotePath", () => {
  it("quotes paths with spaces", () => {
    expect(shellQuotePath("/Users/me/my file")).toBe("'/Users/me/my file'");
  });

  it("leaves simple paths unquoted", () => {
    expect(shellQuotePath("/Users/me/foo.txt")).toBe("/Users/me/foo.txt");
  });
});

describe("pathFromDropLine", () => {
  it("parses file:// URLs from plain text", () => {
    expect(pathFromDropLine("file:///Users/me/photo.jpg")).toBe(
      "/Users/me/photo.jpg",
    );
  });

  it("parses quoted absolute paths", () => {
    expect(
      pathFromDropLine(
        '"/var/folders/tmp/Screenshot 2026-05-23 at 11.36.25\u202fPM.png"',
      ),
    ).toBe("/var/folders/tmp/Screenshot 2026-05-23 at 11.36.25\u202fPM.png");
  });

  it("resolves worktree-relative paths from the file tree", () => {
    expect(
      pathFromDropLine("assets/photo.png", {
        worktreeRoot: "/Users/me/project",
      }),
    ).toBe("/Users/me/project/assets/photo.png");
  });
});

describe("resolveBasenameInFileTree", () => {
  it("resolves a unique basename", () => {
    expect(
      resolveBasenameInFileTree(
        "photo.png",
        ["assets/photo.png", "src/main.ts"],
        "/Users/me/project",
      ),
    ).toBe("/Users/me/project/assets/photo.png");
  });

  it("returns null when ambiguous", () => {
    expect(
      resolveBasenameInFileTree(
        "photo.png",
        ["a/photo.png", "b/photo.png"],
        "/Users/me/project",
      ),
    ).toBeNull();
  });
});

describe("resolveRelativeToWorktreeRoot", () => {
  it("strips leading ./", () => {
    expect(resolveRelativeToWorktreeRoot("./src/a.ts", "/repo")).toBe(
      "/repo/src/a.ts",
    );
  });
});

describe("pathsFromDataTransfer", () => {
  it("reads text/uri-list", () => {
    const dt = {
      getData: (type: string) =>
        type === "text/uri-list"
          ? "file:///Users/me/a.txt\nfile:///Users/me/b.txt"
          : "",
      files: [],
      types: ["text/uri-list"],
    } as unknown as DataTransfer;
    expect(pathsFromDataTransfer(dt)).toEqual([
      "/Users/me/a.txt",
      "/Users/me/b.txt",
    ]);
  });

  it("reads file:// URLs from text/plain when uri-list is empty", () => {
    const dt = {
      getData: (type: string) =>
        type === "text/plain" ? "file:///Users/me/photo.png" : "",
      files: [{ name: "photo.png" }],
      types: ["Files", "text/plain"],
    } as unknown as DataTransfer;
    expect(pathsFromDataTransfer(dt)).toEqual(["/Users/me/photo.png"]);
  });

  it("prefers File.path over basename when uri-list is empty", () => {
    const dt = {
      getData: () => "",
      files: [{ name: "photo.png", path: "/Users/me/photo.png" }],
      types: ["Files"],
    } as unknown as DataTransfer;
    expect(pathsFromDataTransfer(dt)).toEqual(["/Users/me/photo.png"]);
  });

  it("resolves relative plain text with worktree root", () => {
    const dt = {
      getData: (type: string) =>
        type === "text/plain" ? "assets/photo.png" : "",
      files: [],
      types: ["text/plain"],
    } as unknown as DataTransfer;
    expect(
      pathsFromDataTransfer(dt, { worktreeRoot: "/Users/me/project" }),
    ).toEqual(["/Users/me/project/assets/photo.png"]);
  });

  it("falls back to file names", () => {
    const dt = {
      getData: () => "",
      files: [{ name: "readme.md" }],
      types: ["Files"],
    } as unknown as DataTransfer;
    expect(pathsFromDataTransfer(dt)).toEqual(["readme.md"]);
  });

  it("resolves basename via file tree index", () => {
    const dt = {
      getData: () => "",
      files: [{ name: "photo.png" }],
      types: ["Files"],
    } as unknown as DataTransfer;
    expect(
      pathsFromDataTransfer(dt, {
        worktreeRoot: "/Users/me/project",
        fileTreePaths: ["assets/photo.png", "src/main.ts"],
      }),
    ).toEqual(["/Users/me/project/assets/photo.png"]);
  });
});

afterEach(() => {
  clearDragPayload();
});

describe("formatPathsForTerminal", () => {
  it("joins quoted paths with trailing space", () => {
    expect(formatPathsForTerminal(["/a", "/b c"])).toBe("/a '/b c' ");
  });
});
