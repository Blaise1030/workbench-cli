import type { ContextQueueAnnotationMeta } from "@/modules/context-queue/lib/context-queue-annotation-types";

/** Popover is expanded (editor) or collapsed (summary only). */
export function isAnnotationExpanded(meta: ContextQueueAnnotationMeta): boolean {
  return meta.expanded !== false;
}
