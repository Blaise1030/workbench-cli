import type { ContextQueueAnnotationMeta } from "@/modules/context-queue/lib/context-queue-annotation-types";

export function hasCommentContent(meta: ContextQueueAnnotationMeta): boolean {
  return Boolean(meta.note.trim()) || meta.queued === true;
}

/** Editor until the user has written a note or queued; then respect expanded flag. */
export function shouldShowEditor(meta: ContextQueueAnnotationMeta): boolean {
  if (!hasCommentContent(meta)) return true;
  return meta.expanded === true;
}
