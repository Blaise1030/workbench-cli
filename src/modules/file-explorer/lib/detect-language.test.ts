import { describe, expect, it } from "vitest";
import { detectLanguage } from "./detect-language.js";

describe("detectLanguage", () => {
  it("detects TypeScript files", () => {
    expect(detectLanguage("src/index.ts")).not.toBeNull();
  });

  it("detects TSX files", () => {
    expect(detectLanguage("src/App.tsx")).not.toBeNull();
  });

  it("detects JavaScript files", () => {
    expect(detectLanguage("scripts/build.js")).not.toBeNull();
  });

  it("detects Python files", () => {
    expect(detectLanguage("main.py")).not.toBeNull();
  });

  it("detects JSON files", () => {
    expect(detectLanguage("package.json")).not.toBeNull();
  });

  it("detects CSS files", () => {
    expect(detectLanguage("styles.css")).not.toBeNull();
  });

  it("detects HTML files", () => {
    expect(detectLanguage("index.html")).not.toBeNull();
  });

  it("detects Markdown files", () => {
    expect(detectLanguage("README.md")).not.toBeNull();
  });

  it("returns null for unknown extensions", () => {
    expect(detectLanguage("binary.wasm")).toBeNull();
    expect(detectLanguage("no-extension")).toBeNull();
  });

  it("handles nested paths correctly", () => {
    expect(detectLanguage("src/deep/nested/file.ts")).not.toBeNull();
  });
});
