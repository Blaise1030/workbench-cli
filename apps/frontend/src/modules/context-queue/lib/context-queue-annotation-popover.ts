import type {
  CodeViewItem,
  DiffLineAnnotation,
  LineAnnotation,
  SelectionSide,
} from "@pierre/diffs";
import van from "vanjs-core";
import { buttonVariants } from "@/components/ui/button";
import { badgeVariants } from "@/components/ui/badge";
import { textareaVariants } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { ContextQueueAnnotationMeta } from "@/modules/context-queue/lib/context-queue-annotation-types";
import { isAnnotationExpanded } from "@/modules/context-queue/lib/context-queue-annotation-display";
import { formatPathReference } from "@/modules/context-queue/lib/format-line-range";

const { div, span, label, input, textarea, button, p } = van.tags;

const { svg, path: svgPath } = van.tags("http://www.w3.org/2000/svg");

type AnyAnnotation =
  | LineAnnotation<ContextQueueAnnotationMeta>
  | DiffLineAnnotation<ContextQueueAnnotationMeta>;

export type AnnotationCallbacks = {
  onNoteChange: (id: string, note: string) => void;
  onIncludeSnippetChange: (id: string, include: boolean) => void;
  onQueue: (meta: ContextQueueAnnotationMeta) => void;
  onRemove: (id: string) => void;
  onExpand: (id: string) => void;
  onCollapse: (id: string) => void;
};

const MAX_PREVIEW_CHARS = 280;

const stopBubble = (event: Event) => event.stopPropagation();

const snippetCheckboxClass = cn(
  "size-3.5 shrink-0 cursor-pointer rounded border border-input bg-background accent-primary",
  "appearance-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30",
  "checked:border-primary checked:bg-primary checked:bg-center checked:bg-no-repeat checked:[background-size:0.75rem]",
  "checked:[background-image:url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M20 6 9 17l-5-5'/%3E%3C/svg%3E\")]",
);

const popoverShellClass =
  "comment box-border m-1 flex w-full max-w-[500px] flex-col overflow-hidden rounded border border-border bg-popover p-2 font-sans text-sm text-popover-foreground shadow-sm";

const popoverBodyClass = "flex flex-col gap-2 px-0.5 pb-0.5";

function shellClass(queued: boolean): string {
  return queued
    ? `${popoverShellClass} border-primary/40 ring-1 ring-primary/25`
    : popoverShellClass;
}

function truncateText(text: string, max: number): string {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max)}…`;
}

function pathLabel(meta: ContextQueueAnnotationMeta): string {
  return formatPathReference(meta.relativePath, meta.range, {
    diff: meta.diff,
  });
}

function ChevronIcon(expanded: boolean) {
  return span(
    {
      class: cn(
        "mt-0.5 inline-flex shrink-0 text-muted-foreground transition-transform duration-200",
        expanded && "rotate-180",
      ),
      "aria-hidden": "true",
    },
    svg(
      {
        class: "size-4",
        viewBox: "0 0 24 24",
        fill: "none",
        stroke: "currentColor",
        "stroke-width": "2",
        "stroke-linecap": "round",
        "stroke-linejoin": "round",
      },
      svgPath({ d: "m6 9 6 6 6-6" }),
    ),
  );
}

function QueuedBadge() {
  return span({ class: badgeVariants({ variant: "secondary" }) }, "Queued");
}

function PopoverHeader(
  meta: ContextQueueAnnotationMeta,
  expanded: boolean,
  callbacks: AnnotationCallbacks,
) {
  const toggle = () => {
    if (expanded) callbacks.onCollapse(meta.id);
    else callbacks.onExpand(meta.id);
  };

  return button(
    {
      type: "button",
      class:
        "flex w-full min-w-0 items-start py-1 gap-2 rounded-sm p-0 text-left hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
      "aria-expanded": expanded,
      onclick: (event: Event) => {
        stopBubble(event);
        toggle();
      },
      onmousedown: stopBubble,
    },
    ChevronIcon(expanded),
    div(
      { class: "flex min-w-0 flex-1 items-start justify-between gap-2" },
      span(
        {
          class: "min-w-0 text-sm leading-snug break-all",
        },
        pathLabel(meta),
      ),
      meta.queued ? QueuedBadge() : null,
    ),
  );
}

function PopoverDivider() {
  return div({
    class: "my-2 border-t border-border",
    role: "separator",
  });
}

function CollapsedBody(meta: ContextQueueAnnotationMeta) {
  const noteText = meta.note.trim();

  if (noteText) {
    return p(
      {
        class: "m-0 line-clamp-2 text-sm leading-snug text-foreground",
      },
      truncateText(noteText, MAX_PREVIEW_CHARS),
    );
  }

  return p({ class: "m-0 text-xs text-muted-foreground" }, "No comment yet");
}

function syncIncludeSnippet(
  meta: ContextQueueAnnotationMeta,
  callbacks: AnnotationCallbacks,
  include: boolean,
) {
  meta.includeSnippet = include;
  callbacks.onIncludeSnippetChange(meta.id, include);
}

function EditorBody(
  meta: ContextQueueAnnotationMeta,
  callbacks: AnnotationCallbacks,
) {
  const includeSnippet = van.state(Boolean(meta.includeSnippet));

  const note = textarea({
    class: cn(
      textareaVariants(),
      "min-h-12 resize-y bg-background text-foreground",
    ),
    placeholder: "Comment for the agent…",
    rows: 2,
    spellcheck: false,
    value: meta.note,
    oninput: (event: Event) => {
      callbacks.onNoteChange(
        meta.id,
        (event.target as HTMLTextAreaElement).value,
      );
    },
    onmousedown: stopBubble,
    onclick: stopBubble,
  });

  const setIncludeSnippet = (checked: boolean) => {
    includeSnippet.val = checked;
    syncIncludeSnippet(meta, callbacks, checked);
  };

  const snippetInput = input({
    type: "checkbox",
    class: snippetCheckboxClass,
    checked: includeSnippet,
    oninput: (event: Event) => {
      setIncludeSnippet((event.target as HTMLInputElement).checked);
    },
    onchange: (event: Event) => {
      setIncludeSnippet((event.target as HTMLInputElement).checked);
    },
    onclick: stopBubble,
    onmousedown: stopBubble,
  });

  const removeBtn = button(
    {
      type: "button",
      class: buttonVariants({ variant: "outline", size: "xs" }),
      onclick: (event: Event) => {
        stopBubble(event);
        callbacks.onRemove(meta.id);
      },
      onmousedown: stopBubble,
    },
    "Remove",
  );

  const queueBtn = button(
    {
      type: "button",
      class: buttonVariants({ variant: "default", size: "sm" }),
      disabled: meta.queued,
      onclick: (event: Event) => {
        stopBubble(event);
        callbacks.onQueue({
          ...meta,
          note: note.value,
          includeSnippet: includeSnippet.val,
        });
        callbacks.onRemove(meta.id);
      },
      onmousedown: stopBubble,
    },
    meta.queued ? "In queue" : "Add to queue",
  );

  requestAnimationFrame(() => note.focus());

  return div(
    { class: popoverBodyClass },
    label(
      {
        class:
          "flex cursor-pointer items-center gap-1 text-xs text-muted-foreground select-none",
      },
      snippetInput,
      span({}, "Include code in queue"),
    ),
    note,
    div(
      { class: "flex flex-wrap items-center justify-end gap-1 pt-1" },
      removeBtn,
      queueBtn,
    ),
  );
}

function ContextQueuePopover(
  meta: ContextQueueAnnotationMeta,
  callbacks: AnnotationCallbacks,
) {
  if (meta.includeSnippet == null) meta.includeSnippet = false;

  const expanded = isAnnotationExpanded(meta);

  return div(
    { class: shellClass(meta.queued === true) },
    PopoverHeader(meta, expanded, callbacks),
    PopoverDivider(),
    expanded ? EditorBody(meta, callbacks) : CollapsedBody(meta),
  );
}

export function createContextQueueAnnotationElement(
  annotation: AnyAnnotation,
  callbacks: AnnotationCallbacks,
): HTMLElement {
  const meta = annotation.metadata;
  if (!meta) {
    return div({ class: shellClass(false) }, "Invalid comment");
  }

  return ContextQueuePopover(meta, callbacks);
}

/** Pierre CodeView callbacks pass virtualized context, not the item directly. */
export function resolveCodeViewItem(
  value: CodeViewItem | { item: CodeViewItem } | null | undefined,
): CodeViewItem | null {
  if (value == null) return null;
  if ("item" in value && value.item != null) return value.item;
  return value;
}

export function relativePathForItem(item: CodeViewItem): string {
  if (item.type === "file") {
    return item.id;
  }
  return item.fileDiff?.name ?? item.id;
}

export function annotationSideFromRange(range: {
  side?: SelectionSide;
  endSide?: SelectionSide;
}): "deletions" | "additions" {
  return range.endSide ?? range.side ?? "additions";
}
