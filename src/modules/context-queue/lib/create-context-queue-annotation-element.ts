import type {
  CodeViewItem,
  DiffLineAnnotation,
  LineAnnotation,
  SelectionSide,
} from "@pierre/diffs";
import { buttonVariants } from "@/components/ui/button";
import { cqAnnotationClasses as c } from "@/modules/context-queue/lib/context-queue-annotation-classes";
import type { ContextQueueAnnotationMeta } from "@/modules/context-queue/lib/context-queue-annotation-types";
import {
  hasCommentContent,
  shouldShowEditor,
} from "@/modules/context-queue/lib/context-queue-annotation-display";
import { formatPathReference } from "@/modules/context-queue/lib/format-line-range";

type AnyAnnotation =
  | LineAnnotation<ContextQueueAnnotationMeta>
  | DiffLineAnnotation<ContextQueueAnnotationMeta>;

type AnnotationCallbacks = {
  onNoteChange: (id: string, note: string) => void;
  onIncludeSnippetChange: (id: string, include: boolean) => void;
  onQueue: (meta: ContextQueueAnnotationMeta) => void;
  onRemove: (id: string) => void;
  onExpand: (id: string) => void;
  onCollapse: (id: string) => void;
};

const MAX_PREVIEW_CHARS = 280;

function truncateText(text: string, max: number): string {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max)}…`;
}

function createPreviewAnnotationElement(
  meta: ContextQueueAnnotationMeta,
  callbacks: AnnotationCallbacks,
): HTMLElement {
  const card = document.createElement("div");
  card.className = meta.queued
    ? `${c.previewCard} ${c.rootQueued}`
    : c.previewCard;
  card.setAttribute("role", "button");
  card.tabIndex = 0;
  card.setAttribute(
    "aria-label",
    meta.queued ? "Queued comment — click to edit" : "Comment — click to edit",
  );

  const header = document.createElement("div");
  header.className = "flex items-start justify-between gap-2";

  const path = document.createElement("h6");
  path.className = c.path;
  path.textContent = formatPathReference(meta.relativePath, meta.range, {
    diff: meta.diff,
  });
  header.append(path);

  if (meta.queued) {
    const badge = document.createElement("span");
    badge.className = c.previewBadge;
    badge.textContent = "Queued";
    header.append(badge);
  }

  const noteText = meta.note.trim();
  const selectionText = meta.selection.trim();

  if (noteText) {
    const note = document.createElement("p");
    note.className = c.previewNote;
    note.textContent = truncateText(noteText, MAX_PREVIEW_CHARS);
    card.append(header, note);
  } else if (selectionText) {
    const code = document.createElement("pre");
    code.className = c.previewCode;
    code.textContent = truncateText(selectionText, MAX_PREVIEW_CHARS);
    card.append(header, code);
  } else {
    card.append(header);
  }

  const hint = document.createElement("p");
  hint.className = c.previewHint;
  hint.textContent = "Click to edit";
  card.append(hint);

  const expand = () => callbacks.onExpand(meta.id);

  card.addEventListener("click", expand);
  card.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    expand();
  });

  return card;
}

function createEditorAnnotationElement(
  meta: ContextQueueAnnotationMeta,
  callbacks: AnnotationCallbacks,
): HTMLElement {
  const root = document.createElement("div");
  root.className = meta.queued ? `${c.root} ${c.rootQueued}` : c.root;

  const path = document.createElement("h6");
  path.className = c.path;
  path.textContent = formatPathReference(meta.relativePath, meta.range, {
    diff: meta.diff,
  });

  const snippetToggle = document.createElement("label");
  snippetToggle.className = c.toggle;
  const snippetInput = document.createElement("input");
  snippetInput.type = "checkbox";
  snippetInput.className = c.toggleInput;
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
  previewDetails.className = c.preview;
  previewDetails.open = meta.includeSnippet;
  const previewSummary = document.createElement("summary");
  previewSummary.className = c.previewSummary;
  previewSummary.textContent = "Selection preview";
  const selection = document.createElement("pre");
  selection.className = c.selection;
  const preview = meta.selection.trim();
  selection.textContent =
    preview.length > MAX_PREVIEW_CHARS
      ? `${preview.slice(0, MAX_PREVIEW_CHARS)}\n… (${preview.length.toLocaleString()} chars)`
      : preview || "(empty selection)";
  previewDetails.append(previewSummary, selection);

  const note = document.createElement("textarea");
  note.className = c.note;
  note.placeholder = "Comment for the agent…";
  note.value = meta.note;
  note.rows = 2;
  note.spellcheck = false;
  note.addEventListener("input", () => {
    callbacks.onNoteChange(meta.id, note.value);
  });
  note.addEventListener("mousedown", (event) => event.stopPropagation());
  note.addEventListener("click", (event) => event.stopPropagation());

  const actions = document.createElement("div");
  actions.className = c.actions;

  const removeBtn = document.createElement("button");
  removeBtn.type = "button";
  removeBtn.className = buttonVariants({ variant: "outline", size: "xs" });
  removeBtn.textContent = "Remove";
  removeBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    callbacks.onRemove(meta.id);
  });
  removeBtn.addEventListener("mousedown", (event) => event.stopPropagation());

  const queueBtn = document.createElement("button");
  queueBtn.type = "button";
  queueBtn.className = buttonVariants({ variant: "default", size: "xs" });
  queueBtn.textContent = meta.queued ? "In queue" : "Add to queue";
  queueBtn.disabled = meta.queued;
  queueBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    callbacks.onQueue({
      ...meta,
      note: note.value,
      includeSnippet: snippetInput.checked,
    });
  });
  queueBtn.addEventListener("mousedown", (event) => event.stopPropagation());

  if (meta.queued) {
    const badge = document.createElement("span");
    badge.className = c.badge;
    badge.textContent = "Queued";
    actions.append(badge);
  }

  if (hasCommentContent(meta)) {
    const collapseBtn = document.createElement("button");
    collapseBtn.type = "button";
    collapseBtn.className = buttonVariants({ variant: "ghost", size: "xs" });
    collapseBtn.textContent = "Collapse";
    collapseBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      callbacks.onCollapse(meta.id);
    });
    collapseBtn.addEventListener("mousedown", (event) =>
      event.stopPropagation(),
    );
    actions.append(collapseBtn);
  }

  actions.append(removeBtn, queueBtn);
  root.append(path, snippetToggle, previewDetails, note, actions);

  requestAnimationFrame(() => note.focus());

  return root;
}

export function createContextQueueAnnotationElement(
  annotation: AnyAnnotation,
  callbacks: AnnotationCallbacks,
): HTMLElement {
  const meta = annotation.metadata;
  if (!meta) {
    const empty = document.createElement("div");
    empty.className = c.root;
    empty.textContent = "Invalid comment";
    return empty;
  }

  if (shouldShowEditor(meta)) {
    return createEditorAnnotationElement(meta, callbacks);
  }
  return createPreviewAnnotationElement(meta, callbacks);
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
