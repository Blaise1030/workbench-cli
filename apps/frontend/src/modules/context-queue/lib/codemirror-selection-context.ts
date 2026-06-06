import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import type { SelectedLineRange } from "@pierre/diffs";
import { resolveExplorerPath } from "@/modules/context-queue/lib/resolve-code-context";
import type { useContextQueue } from "@/modules/context-queue/hooks/use-context-queue";

export type CodeMirrorExplorerContext = {
  relativePath?: string;
  lineRange?: SelectedLineRange;
  selection: string;
};

/** Active file editor in the explorer panel, if mounted. */
export function findCodeMirrorEditorView(): EditorView | null {
  if (typeof document === "undefined") return null;
  const host = document.querySelector(".code-mirror-editor");
  if (!host) return null;
  if (host instanceof HTMLElement) {
    const view = EditorView.findFromDOM(host);
    if (view) return view;
  }
  const cmEditor = host.querySelector(".cm-editor");
  if (cmEditor instanceof HTMLElement) {
    return EditorView.findFromDOM(cmEditor);
  }
  return null;
}

export function resolveCodeMirrorExplorerContext(opts: {
  worktreePath?: string;
  fileQueryEncoded?: string;
  relativePath?: string | null;
}): CodeMirrorExplorerContext {
  const relativePath =
    opts.relativePath?.trim() ||
    resolveExplorerPath(opts.worktreePath ?? "", opts.fileQueryEncoded) ||
    undefined;
  const view = findCodeMirrorEditorView();
  if (!view) {
    return { relativePath, selection: "" };
  }
  return {
    relativePath,
    lineRange: lineRangeFromEditorState(view.state),
    selection: selectionTextFromEditorState(view.state),
  };
}

export function appendExplorerCodeMirrorToQueue(
  queue: ReturnType<typeof useContextQueue>,
  opts: {
    worktreePath?: string;
    fileQueryEncoded?: string;
    relativePath?: string | null;
  },
): boolean {
  const ctx = resolveCodeMirrorExplorerContext(opts);
  if (!ctx.relativePath || !ctx.lineRange) return false;

  const selection = ctx.selection.trim();
  queue.appendFromContext({
    relativePath: ctx.relativePath,
    lineRange: ctx.lineRange,
    selection: selection || undefined,
    diff: false,
    includeSnippet: false,
  });
  return true;
}

/** 1-based inclusive line span from the primary CodeMirror selection. */
export function lineRangeFromEditorState(state: EditorState): SelectedLineRange {
  const { from, to } = state.selection.main;
  const doc = state.doc;
  const startLine = doc.lineAt(from).number;
  let endLine = doc.lineAt(to).number;
  if (to > from && to === doc.lineAt(to).from) {
    endLine = Math.max(startLine, endLine - 1);
  }
  const start = Math.min(startLine, endLine);
  const end = Math.max(startLine, endLine);
  return { start, end };
}

export function selectionTextFromEditorState(state: EditorState): string {
  const { from, to } = state.selection.main;
  return state.sliceDoc(from, to);
}
