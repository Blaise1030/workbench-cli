import type { SelectedLineRange } from "@pierre/diffs";

export type ContextQueueAnnotationMeta = {
  id: string;
  itemId: string;
  relativePath: string;
  range: SelectedLineRange;
  /** Full selected text (preview only; queue uses path + lines unless includeSnippet). */
  selection: string;
  note: string;
  includeSnippet: boolean;
  diff: boolean;
  queued?: boolean;
  /** Collapsed summary first; click expands the full editor. */
  expanded?: boolean;
};
