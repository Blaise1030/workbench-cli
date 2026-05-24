import { describe, it, expect } from "vitest";
import { RingBuffer } from "./ring-buffer.js";

describe("RingBuffer", () => {
  it("evicts oldest data when over cap", () => {
    const ring = new RingBuffer(10);
    ring.append("12345");
    ring.append("67890");
    ring.append("X");
    expect(ring.snapshot().toString("utf-8")).toBe("67890X");
  });

  it("returns empty buffer when empty", () => {
    const ring = new RingBuffer(100);
    expect(ring.snapshot().length).toBe(0);
  });
});
