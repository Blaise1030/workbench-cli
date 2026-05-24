import { describe, expect, it } from "vitest";
import {
  fileUrlToPath,
  formatPathsForTerminal,
  pathsFromDataTransfer,
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

  it("falls back to file names", () => {
    const dt = {
      getData: () => "",
      files: [{ name: "readme.md" }],
      types: ["Files"],
    } as unknown as DataTransfer;
    expect(pathsFromDataTransfer(dt)).toEqual(["readme.md"]);
  });
});

describe("formatPathsForTerminal", () => {
  it("joins quoted paths with trailing space", () => {
    expect(formatPathsForTerminal(["/a", "/b c"])).toBe("/a '/b c' ");
  });
});
