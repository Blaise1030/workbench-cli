import { afterEach, describe, expect, it } from "vitest";
import {
  checkDroppableItems,
  clearDragPayload,
  dedupeDropPaths,
  fileUrlToPath,
  formatPathsForTerminal,
  isUsableDropPath,
  normalizeDropPathForCompare,
  partitionDroppedFiles,
  pathFromDropLine,
  pathsFromDataTransfer,
  pathsFromFileList,
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

describe("checkDroppableItems", () => {
  it("accepts file items", () => {
    const items = [{ kind: "file", type: "image/png" }] as DataTransferItem[];
    expect(checkDroppableItems(items as unknown as DataTransferItemList)).toBe(
      true,
    );
  });

  it("accepts text/plain string items", () => {
    const items = [{ kind: "string", type: "text/plain" }] as DataTransferItem[];
    expect(checkDroppableItems(items as unknown as DataTransferItemList)).toBe(
      true,
    );
  });

  it("rejects empty lists", () => {
    expect(checkDroppableItems([] as unknown as DataTransferItemList)).toBe(
      false,
    );
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

describe("dedupeDropPaths", () => {
  it("treats narrow no-break space and regular space as the same path", () => {
    const a =
      "/var/folders/tmp/Screenshot 2026-05-25 at 11.36.49\u202fPM.png";
    const b =
      "/var/folders/tmp/Screenshot 2026-05-25 at 11.36.49 PM.png";
    expect(normalizeDropPathForCompare(a)).toBe(normalizeDropPathForCompare(b));
    expect(dedupeDropPaths([a, b])).toEqual([a]);
  });
});

describe("isUsableDropPath", () => {
  it("accepts absolute paths", () => {
    expect(isUsableDropPath("/tmp/a.txt")).toBe(true);
  });

  it("rejects bare filenames", () => {
    expect(isUsableDropPath("photo.png")).toBe(false);
  });

  it("accepts worktree-relative paths with slashes", () => {
    expect(
      isUsableDropPath("src/a.ts", { worktreeRoot: "/repo" }),
    ).toBe(true);
  });
});

describe("partitionDroppedFiles", () => {
  it("sends bare names to upload", () => {
    const file = { name: "photo.png" } as File;
    const { resolved, needsUpload } = partitionDroppedFiles([file]);
    expect(resolved).toEqual([]);
    expect(needsUpload).toEqual([file]);
  });

  it("keeps resolved paths from File.path", () => {
    const file = { name: "photo.png", path: "/Users/me/photo.png" } as File;
    const { resolved, needsUpload } = partitionDroppedFiles([file]);
    expect(resolved).toEqual(["/Users/me/photo.png"]);
    expect(needsUpload).toEqual([]);
  });
});

describe("pathsFromFileList", () => {
  it("uses File.path when available", () => {
    const file = { name: "readme.md", path: "/Users/me/readme.md" } as File;
    expect(pathsFromFileList([file])).toEqual(["/Users/me/readme.md"]);
  });

  it("resolves webkitRelativePath against worktree root", () => {
    const file = {
      name: "index.ts",
      webkitRelativePath: "src/index.ts",
    } as File;
    expect(
      pathsFromFileList([file], { worktreeRoot: "/Users/me/project" }),
    ).toEqual(["/Users/me/project/src/index.ts"]);
  });
});

describe("formatPathsForTerminal", () => {
  it("joins quoted paths with trailing space", () => {
    expect(formatPathsForTerminal(["/a", "/b c"])).toBe("/a '/b c' ");
  });
});
