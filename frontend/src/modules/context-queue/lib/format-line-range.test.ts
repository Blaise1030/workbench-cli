import { describe, expect, it } from "vitest";
import {
  formatContextPointer,
  isCrossSideRange,
  singleSideRange,
} from "./format-line-range";

describe("isCrossSideRange", () => {
  it("detects mixed sides", () => {
    expect(
      isCrossSideRange({
        start: 5,
        side: "deletions",
        end: 12,
        endSide: "additions",
      }),
    ).toBe(true);
  });
});

describe("singleSideRange", () => {
  it("collapses cross-side to end line on end side", () => {
    expect(
      singleSideRange({
        start: 5,
        side: "deletions",
        end: 12,
        endSide: "additions",
      }),
    ).toEqual({
      start: 12,
      end: 12,
      side: "additions",
      endSide: "additions",
    });
  });
});

describe("formatContextPointer", () => {
  it("uses path:from:to for files", () => {
    expect(
      formatContextPointer("src/a.ts", { start: 12, end: 18 }),
    ).toBe("src/a.ts:12:18");
  });

  it("uses path:new:from:to for diff additions", () => {
    expect(
      formatContextPointer(
        "src/a.ts",
        { start: 10, end: 14, side: "additions", endSide: "additions" },
        { diff: true },
      ),
    ).toBe("src/a.ts:new:10:14");
  });

  it("uses path:old:from:to for diff deletions", () => {
    expect(
      formatContextPointer(
        "src/a.ts",
        { start: 1, end: 2, side: "deletions", endSide: "deletions" },
        { diff: true },
      ),
    ).toBe("src/a.ts:old:1:2");
  });
});
