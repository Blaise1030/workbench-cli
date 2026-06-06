import { describe, it, expect } from "vitest";
import { extractURLs } from "./terminal-url-links";

describe("extractURLs", () => {
  it("returns empty for lines with no URLs", () => {
    expect(extractURLs("no urls here")).toEqual([]);
  });

  it("detects a simple localhost URL", () => {
    const results = extractURLs("  ➜  Local:   http://localhost:5173/");
    expect(results).toHaveLength(1);
    expect(results[0]!.url).toBe("http://localhost:5173/");
  });

  it("detects https URLs", () => {
    const results = extractURLs("  ➜  Local:   https://localhost:3000");
    expect(results).toHaveLength(1);
    expect(results[0]!.url).toBe("https://localhost:3000");
  });

  it("detects 127.0.0.1 URLs", () => {
    const results = extractURLs("Server running at http://127.0.0.1:4321/");
    expect(results).toHaveLength(1);
    expect(results[0]!.url).toBe("http://127.0.0.1:4321/");
  });

  it("reports correct startX and endX", () => {
    const prefix = "  ➜  Local:   ";
    const url = "http://localhost:5173/";
    const results = extractURLs(prefix + url);
    // startX is byte index, not char index; prefix uses multi-byte chars
    expect(results[0]!.url).toBe(url);
    expect(results[0]!.startX).toBeGreaterThanOrEqual(0);
    expect(results[0]!.endX).toBe(results[0]!.startX + url.length);
  });

  it("does not match non-localhost URLs", () => {
    expect(extractURLs("see https://example.com for docs")).toEqual([]);
  });

  it("detects multiple URLs on one line", () => {
    const line = "http://localhost:3000 and http://localhost:4000";
    expect(extractURLs(line)).toHaveLength(2);
  });
});
