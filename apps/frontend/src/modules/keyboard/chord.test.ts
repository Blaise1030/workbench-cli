import { describe, expect, it } from "vitest";
import {
  chordLabel,
  isBrowserReservedChord,
  normalizeStoredChord,
} from "./chord";

describe("isBrowserReservedChord", () => {
  it("flags common browser tab and window shortcuts", () => {
    expect(isBrowserReservedChord("Meta+1")).toBe(true);
    expect(isBrowserReservedChord("Meta+n")).toBe(true);
    expect(isBrowserReservedChord("Ctrl+t")).toBe(true);
  });

  it("allows Ctrl+Shift chords used as built-in options", () => {
    expect(isBrowserReservedChord("Ctrl+Shift+n")).toBe(false);
    expect(isBrowserReservedChord("Option+¡")).toBe(false);
  });
});

describe("normalizeStoredChord", () => {
  it("maps legacy Alt modifier to Option", () => {
    expect(normalizeStoredChord("Alt+Shift+n")).toBe("Option+Shift+n");
  });
});

describe("chordLabel", () => {
  it("renders Ctrl+Shift chords", () => {
    expect(chordLabel("Ctrl+Shift+n")).toBe("⌃⇧n");
    expect(chordLabel("Ctrl+Shift+e")).toBe("⌃⇧e");
    expect(chordLabel("Option+¡")).toBe("⌥¡");
    expect(normalizeStoredChord("Option+1")).toBe("Option+¡");
  });
});
