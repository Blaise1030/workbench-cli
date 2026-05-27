import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clampPopupRect } from "./context-queue-anchor";

function mockWindow(innerWidth: number, innerHeight: number) {
  vi.stubGlobal("window", {
    innerWidth,
    innerHeight,
    visualViewport: undefined,
  });
}

describe("clampPopupRect", () => {
  beforeEach(() => {
    mockWindow(1024, 768);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("places popup to the right and below the anchor when there is room", () => {
    mockWindow(500, 500);
    const anchor = { left: 10, top: 10, width: 5, height: 5 };
    expect(clampPopupRect(anchor, 100, 50)).toEqual({ left: 23, top: 23 });
  });

  it("moves popup to the left when it would overflow the right edge", () => {
    mockWindow(200, 500);
    const anchor = { left: 150, top: 10, width: 10, height: 5 };
    expect(clampPopupRect(anchor, 120, 40)).toEqual({ left: 22, top: 23 });
  });

  it("moves popup upward when it would overflow the bottom edge", () => {
    mockWindow(500, 100);
    const anchor = { left: 10, top: 80, width: 5, height: 5 };
    expect(clampPopupRect(anchor, 120, 40)).toEqual({ left: 23, top: 32 });
  });
});
