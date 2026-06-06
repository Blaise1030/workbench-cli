import type {
  CodeViewItem,
  CodeViewLineSelection,
  SelectedLineRange,
  SelectionSide,
} from "@pierre/diffs";

function normalizedRange(range: SelectedLineRange) {
  const forward = range.start <= range.end;
  return {
    startLine: forward ? range.start : range.end,
    endLine: forward ? range.end : range.start,
    endSide: (forward ? range.endSide : range.side) ?? range.side,
  };
}

function linesForDiffSide(
  item: Extract<CodeViewItem, { type: "diff" }>,
  side: SelectionSide | undefined,
): string[] {
  if (side === "additions") return item.fileDiff.additionLines;
  return item.fileDiff.deletionLines;
}

/** Selected line text from Pierre line arrays (1-based line numbers). */
export function pierreSelectionText(
  items: readonly CodeViewItem[],
  selection: CodeViewLineSelection,
): string {
  const item = items.find((entry) => entry.id === selection.id);
  if (!item) return "";

  const { startLine, endLine, endSide } = normalizedRange(selection.range);
  const lines =
    item.type === "file"
      ? item.file.contents.split("\n")
      : linesForDiffSide(item, endSide);

  const slice = lines.slice(startLine - 1, endLine);
  return slice.join("\n").trimEnd();
}
