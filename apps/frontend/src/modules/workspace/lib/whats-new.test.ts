import { describe, expect, it } from "vitest";
import {
  formatReleaseDate,
  latestUndismissedWhatsNew,
  type WhatsNewEntry,
} from "@/modules/workspace/lib/whats-new";

const ENTRIES: WhatsNewEntry[] = [
  {
    id: "entry-a",
    title: "Entry A",
    summary: "First entry",
    publishedAt: "2026-06-01",
    sections: [],
  },
  {
    id: "entry-b",
    title: "Entry B",
    summary: "Second entry",
    publishedAt: "2026-06-02",
    sections: [],
  },
];

describe("latestUndismissedWhatsNew", () => {
  it("returns the first entry when nothing is dismissed", () => {
    expect(latestUndismissedWhatsNew(ENTRIES, [])).toEqual(ENTRIES[0]);
  });

  it("returns the next entry after the first is dismissed", () => {
    expect(latestUndismissedWhatsNew(ENTRIES, [ENTRIES[0]!.id])).toEqual(ENTRIES[1]);
  });

  it("returns null when all entries are dismissed", () => {
    expect(latestUndismissedWhatsNew(ENTRIES, ENTRIES.map((e) => e.id))).toBeNull();
  });

  it("returns null for empty entries", () => {
    expect(latestUndismissedWhatsNew([], [])).toBeNull();
  });
});

describe("formatReleaseDate", () => {
  it("formats as short month and day", () => {
    expect(formatReleaseDate("2026-06-04")).toMatch(/Jun\s+4/);
  });
});
