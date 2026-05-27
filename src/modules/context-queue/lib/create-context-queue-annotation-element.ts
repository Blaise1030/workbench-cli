import type {
  CodeViewItem,
  DiffLineAnnotation,
  LineAnnotation,
  SelectionSide,
} from "@pierre/diffs";
import type { ContextQueueAnnotationMeta } from "@/modules/context-queue/lib/context-queue-annotation-types";
import { formatPathReference } from "@/modules/context-queue/lib/format-line-range";

type AnyAnnotation =
  | LineAnnotation<ContextQueueAnnotationMeta>
  | DiffLineAnnotation<ContextQueueAnnotationMeta>;

export function createContextQueueAnnotationElement(
  annotation: AnyAnnotation,
  callbacks: {
    onNoteChange: (id: string, note: string) => void;
    onIncludeSnippetChange: (id: string, include: boolean) => void;
    onQueue: (meta: ContextQueueAnnotationMeta) => void;
    onRemove: (id: string) => void;
  },
): HTMLElement {
  const meta = annotation.metadata;
  if (!meta) {
    const empty = document.createElement("div");
    empty.className = "context-queue-annotation";
    empty.textContent = "Invalid comment";
    return empty;
  }

  const root = document.createElement("div");
  root.className = "context-queue-annotation";
  if (meta.queued) root.classList.add("context-queue-annotation--queued");

  const path = document.createElement("div");
  path.className = "context-queue-annotation__path";
  path.textContent = formatPathReference(meta.relativePath, meta.range, {
    diff: meta.diff,
  });

  const snippetToggle = document.createElement("label");
  snippetToggle.className = "context-queue-annotation__toggle";
  const snippetInput = document.createElement("input");
  snippetInput.type = "checkbox";
  snippetInput.className = "context-queue-annotation__toggle-input";
  snippetInput.checked = meta.includeSnippet;
  snippetInput.addEventListener("change", () => {
    meta.includeSnippet = snippetInput.checked;
    callbacks.onIncludeSnippetChange(meta.id, snippetInput.checked);
    previewDetails.open = snippetInput.checked;
  });
  snippetInput.addEventListener("mousedown", (event) => event.stopPropagation());
  const snippetLabel = document.createElement("span");
  snippetLabel.textContent = "Include code in queue";
  snippetToggle.append(snippetInput, snippetLabel);

  const previewDetails = document.createElement("details");
  previewDetails.className = "context-queue-annotation__preview";
  previewDetails.open = meta.includeSnippet;
  const previewSummary = document.createElement("summary");
  previewSummary.className = "context-queue-annotation__preview-summary";
  previewSummary.textContent = "Selection preview";
  const selection = document.createElement("pre");
  selection.className = "context-queue-annotation__selection";
  const preview = meta.selection.trim();
  const maxPreview = 600;
  selection.textContent =
    preview.length > maxPreview
      ? `${preview.slice(0, maxPreview)}\n… (${preview.length.toLocaleString()} chars)`
      : preview || "(empty selection)";
  previewDetails.append(previewSummary, selection);

  const note = document.createElement("textarea");
  note.className = "context-queue-annotation__note";
  note.placeholder = "Comment for the agent…";
  note.value = meta.note;
  note.addEventListener("input", () => {
    callbacks.onNoteChange(meta.id, note.value);
  });
  note.addEventListener("mousedown", (event) => event.stopPropagation());
  note.addEventListener("click", (event) => event.stopPropagation());

  const actions = document.createElement("div");
  actions.className = "context-queue-annotation__actions";

  const queueBtn = document.createElement("button");
  queueBtn.type = "button";
  queueBtn.className =
    "context-queue-annotation__btn context-queue-annotation__btn--primary";
  queueBtn.textContent = meta.queued ? "In queue" : "Add to queue";
  queueBtn.disabled = meta.queued;
  queueBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    callbacks.onQueue({ ...meta, note: note.value, includeSnippet: snippetInput.checked });
  });
  queueBtn.addEventListener("mousedown", (event) => event.stopPropagation());

  const removeBtn = document.createElement("button");
  removeBtn.type = "button";
  removeBtn.className =
    "context-queue-annotation__btn context-queue-annotation__btn--ghost";
  removeBtn.textContent = "Remove";
  removeBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    callbacks.onRemove(meta.id);
  });
  removeBtn.addEventListener("mousedown", (event) => event.stopPropagation());

  if (meta.queued) {
    const badge = document.createElement("span");
    badge.className = "context-queue-annotation__badge";
    badge.textContent = "Queued";
    actions.append(badge);
  }

  actions.append(queueBtn, removeBtn);
  root.append(path, snippetToggle, previewDetails, note, actions);
  return root;
}

export function relativePathForItem(item: CodeViewItem): string {
  if (item.type === "file") {
    return item.id;
  }
  return item.fileDiff.name ?? item.id;
}

export function annotationSideFromRange(
  range: { side?: SelectionSide; endSide?: SelectionSide },
): "deletions" | "additions" {
  return range.endSide ?? range.side ?? "additions";
}
