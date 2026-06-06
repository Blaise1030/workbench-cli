import type { SelectedLineRange, SelectionSide } from "@pierre/diffs";

/** Normalized 1-based inclusive line span. */
export function normalizedLineSpan(range: SelectedLineRange): {
  start: number;
  end: number;
  side?: SelectionSide;
  endSide?: SelectionSide;
} {
  const forward = range.start <= range.end;
  return {
    start: forward ? range.start : range.end,
    end: forward ? range.end : range.start,
    side: range.side,
    endSide: forward ? range.endSide : range.side,
  };
}

/** True when anchor and end are on different diff sides (+/−). */
export function isCrossSideRange(range: SelectedLineRange): boolean {
  const startSide = range.side;
  const endSide = range.endSide ?? range.side;
  return Boolean(startSide && endSide && startSide !== endSide);
}

/**
 * One side per comment (GitHub-style). Cross-side selections collapse to the end
 * line on the end side only.
 */
export function singleSideRange(range: SelectedLineRange): SelectedLineRange {
  if (isCrossSideRange(range)) {
    const forward = range.start <= range.end;
    const line = forward ? range.end : range.start;
    const side = (forward ? range.endSide : range.side) ?? "additions";
    return { start: line, end: line, side, endSide: side };
  }
  const { start, end, side, endSide } = normalizedLineSpan(range);
  const resolved = endSide ?? side;
  return { start, end, side: resolved, endSide: resolved };
}

/** Pierre diff side → `old` (deletions) or `new` (additions). */
export function diffSideToken(side: SelectionSide | undefined): "old" | "new" {
  return side === "deletions" ? "old" : "new";
}

/**
 * Queue pointer for a selection.
 *
 * - File: `src/foo.ts:12:18`
 * - Diff: `src/foo.ts:new:12:18` or `src/foo.ts:old:5:7` (one side only)
 */
export function formatContextPointer(
  relativePath: string,
  range: SelectedLineRange,
  opts?: { diff?: boolean },
): string {
  const path = relativePath.trim();
  const scoped = singleSideRange(range);
  const { start, end } = normalizedLineSpan(scoped);

  if (!opts?.diff) {
    return `${path}:${start}:${end}`;
  }

  const token = diffSideToken(scoped.endSide ?? scoped.side);
  return `${path}:${token}:${start}:${end}`;
}

/** UI label (same pointer string). */
export function formatPathReference(
  relativePath: string,
  range?: SelectedLineRange,
  opts?: { diff?: boolean },
): string {
  if (!range) return relativePath.trim();
  return formatContextPointer(relativePath, range, opts);
}
