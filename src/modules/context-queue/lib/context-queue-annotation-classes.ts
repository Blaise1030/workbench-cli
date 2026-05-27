/** Tailwind classes for Pierre slotted comments (scanned via @source in index.css). */

export const cqAnnotationClasses = {
  root:
    "comment box-border m-2 flex w-full max-w-[600px] flex-col gap-2 overflow-hidden rounded border border-border bg-popover p-2 font-sans text-sm text-popover-foreground shadow-sm",
  rootQueued: "border-primary/40 ring-1 ring-primary/25",
  path: "m-0 p-0 text-sm font-semibold leading-snug break-all text-muted-foreground",
  toggle:
    "flex cursor-pointer items-center gap-2 text-xs text-muted-foreground select-none",
  toggleInput:
    "size-3.5 shrink-0 cursor-pointer appearance-none rounded border border-input bg-background accent-primary focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30",
  preview: "text-xs text-muted-foreground",
  previewSummary:
    "cursor-pointer font-medium text-muted-foreground hover:text-foreground",
  selection:
    "m-0 mt-1 max-h-32 overflow-auto rounded-md border border-border bg-muted/50 p-2 font-mono text-xs leading-relaxed break-words whitespace-pre-wrap text-foreground",
  note: "field-sizing-content flex min-h-12 w-full resize-y rounded-lg border border-input bg-background px-2.5 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30",
  previewCard:
    "comment box-border m-2 flex w-full max-w-[600px] cursor-pointer flex-col gap-1.5 overflow-hidden rounded border border-border bg-popover p-2 text-left font-sans text-sm text-popover-foreground shadow-sm transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
  previewNote: "m-0 line-clamp-2 text-sm leading-snug text-foreground",
  previewCode:
    "m-0 mt-0.5 line-clamp-3 rounded-md border border-border/60 bg-muted/40 p-1.5 font-mono text-xs leading-relaxed break-words whitespace-pre-wrap text-foreground",
  previewHint: "m-0 text-[10px] text-muted-foreground",
  previewBadge: "text-[10px] font-medium tracking-wide text-primary uppercase",
  actions: "flex flex-wrap items-center justify-end gap-2",
  badge:
    "mr-auto text-[10px] font-medium tracking-wide text-muted-foreground uppercase",
} as const;
