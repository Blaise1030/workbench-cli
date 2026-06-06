import { describe, expect, it } from "vitest";
import { EditorState } from "@codemirror/state";
import {
  lineRangeFromEditorState,
  resolveCodeMirrorExplorerContext,
  selectionTextFromEditorState,
} from "./codemirror-selection-context";

function stateWithDoc(
  doc: string,
  selection: { anchor: number; head: number },
): EditorState {
  return EditorState.create({ doc, selection });
}

describe("lineRangeFromEditorState", () => {
  it("maps a single-line selection", () => {
    const state = stateWithDoc("aa\nbb\ncc", { anchor: 3, head: 5 });
    expect(lineRangeFromEditorState(state)).toEqual({ start: 2, end: 2 });
  });

  it("maps a multi-line selection", () => {
    const state = stateWithDoc("aa\nbb\ncc", { anchor: 0, head: 8 });
    expect(lineRangeFromEditorState(state)).toEqual({ start: 1, end: 3 });
  });

  it("maps a collapsed cursor to one line", () => {
    const state = stateWithDoc("aa\nbb\ncc", { anchor: 4, head: 4 });
    expect(lineRangeFromEditorState(state)).toEqual({ start: 2, end: 2 });
  });
});

describe("selectionTextFromEditorState", () => {
  it("returns selected document slice", () => {
    const state = stateWithDoc("hello", { anchor: 1, head: 4 });
    expect(selectionTextFromEditorState(state)).toBe("ell");
  });
});

describe("resolveCodeMirrorExplorerContext", () => {
  it("resolves path without an editor in the DOM", () => {
    expect(
      resolveCodeMirrorExplorerContext({
        worktreePath: "/proj",
        fileQueryEncoded: encodeURIComponent("/proj/src/a.ts"),
      }),
    ).toEqual({
      relativePath: "src/a.ts",
      selection: "",
    });
  });
});
