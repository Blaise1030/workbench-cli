import type {
  CodeViewItem,
  CodeViewLineSelection,
  SelectedLineRange,
  SelectionSide,
} from "@pierre/diffs";
import type { Rect } from "@/modules/code-selection-affix/lib/context-queue-anchor";

const DIFFS_HOST = "diffs-container";

export function findDiffsHostForItem(
  root: HTMLElement,
  itemId: string,
  itemIds: readonly string[],
): HTMLElement | null {
  const hosts = Array.from(root.querySelectorAll(DIFFS_HOST));
  const index = itemIds.indexOf(itemId);
  if (index >= 0 && hosts[index]) return hosts[index] as HTMLElement;
  return null;
}

function normalizedRange(range: SelectedLineRange) {
  const forward = range.start <= range.end;
  return {
    startLine: forward ? range.start : range.end,
    endLine: forward ? range.end : range.start,
    endSide: (forward ? range.endSide : range.side) ?? range.side,
  };
}

function lineElements(
  root: ParentNode,
  lineNumber: number,
): HTMLElement[] {
  return Array.from(
    root.querySelectorAll<HTMLElement>(`[data-column-number="${lineNumber}"]`),
  );
}

function pickLineElement(
  elements: HTMLElement[],
  side: SelectionSide | undefined,
): HTMLElement | null {
  if (!elements.length) return null;
  if (!side || elements.length === 1) return elements[elements.length - 1] ?? null;

  for (const el of elements) {
    const row = el.closest("[data-line-side]");
    const value = row?.getAttribute("data-line-side");
    if (value === side) return el;
  }
  return elements[elements.length - 1] ?? null;
}

/** Viewport rect for the bottom/end line of a Pierre line selection. */
export function pierreSelectionEndRect(
  root: HTMLElement | null,
  itemIds: readonly string[],
  selection: CodeViewLineSelection,
): DOMRect | null {
  if (!root) return null;
  const host = findDiffsHostForItem(root, selection.id, itemIds);
  const shadow = host?.shadowRoot;
  if (!shadow) return null;

  const { endLine, endSide } = normalizedRange(selection.range);
  const lineEl = pickLineElement(lineElements(shadow, endLine), endSide);
  if (!lineEl) return null;

  const rect = lineEl.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) return null;
  return rect;
}

export function pierreSelectionAnchorRect(
  root: HTMLElement | null,
  itemIds: readonly string[],
  selection: CodeViewLineSelection,
): Rect | null {
  const rect = pierreSelectionEndRect(root, itemIds, selection);
  if (!rect) return null;
  return {
    left: rect.left,
    top: rect.top,
    width: Math.max(rect.width, 2),
    height: rect.height,
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
