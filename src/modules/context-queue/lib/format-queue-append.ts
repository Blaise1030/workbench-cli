import type { SelectedLineRange } from "@pierre/diffs";
import {
  formatContextPointer,
  normalizedLineSpan,
} from "@/modules/context-queue/lib/format-line-range";

export function formatQueueAppend({
  relativePath,
  lineRange,
  diff,
  note,
  selection,
  includeSnippet = false,
}: {
  relativePath: string;
  lineRange?: SelectedLineRange;
  diff?: boolean;
  note?: string;
  selection?: string;
  includeSnippet?: boolean;
}): string {
  const comment = note?.trim();
  const body = selection?.trim();

  const lines: string[] = [];

  if (lineRange) {
    lines.push(formatContextPointer(relativePath, lineRange, { diff }));
  } else {
    lines.push(relativePath.trim());
  }

  if (comment) {
    lines.push("```", comment, "```");
  }

  if (includeSnippet && body) {
    lines.push("```", body, "```");
  }

  return `${lines.join("\n")}\n\n`;
}

export { normalizedLineSpan };
