import {
  createAnnotationWrapperNode,
  getLineAnnotationName,
  type CodeViewItem,
} from "@pierre/diffs";
import type { StoredContextQueueAnnotation } from "@/modules/context-queue/lib/context-queue-annotations-state";

const SIGNATURE_ATTR = "data-cq-signature";

/** Stable key for comparing whether a slotted annotation needs re-rendering. */
export function annotationSlotSignature(
  annotation: StoredContextQueueAnnotation,
): string {
  const meta = annotation.metadata;
  const side = "side" in annotation ? annotation.side : "";
  return [
    meta?.id ?? "",
    annotation.lineNumber,
    side,
    meta?.expanded ?? true,
    meta?.note ?? "",
    meta?.queued === true,
    meta?.includeSnippet === true,
  ].join("|");
}

function existingSlotsByName(host: HTMLElement): Map<string, HTMLElement> {
  const map = new Map<string, HTMLElement>();
  for (const el of host.querySelectorAll(".context-queue-annotation-slot")) {
    const slot = el.getAttribute("slot");
    if (slot) map.set(slot, el as HTMLElement);
  }
  return map;
}

/** Pierre skips renderAnnotations() when CodeView owns the container; fill slots ourselves. */
export function syncPierreAnnotationSlotsForHost(
  host: HTMLElement,
  item: CodeViewItem,
  renderAnnotation: (annotation: StoredContextQueueAnnotation) => HTMLElement,
) {
  const desired = item.annotations ?? [];
  const desiredBySlot = new Map<string, StoredContextQueueAnnotation>();
  for (const annotation of desired) {
    desiredBySlot.set(getLineAnnotationName(annotation), annotation);
  }

  const existingBySlot = existingSlotsByName(host);

  for (const [slotName, el] of existingBySlot) {
    if (!desiredBySlot.has(slotName)) {
      el.remove();
      existingBySlot.delete(slotName);
    }
  }

  for (const [slotName, annotation] of desiredBySlot) {
    const signature = annotationSlotSignature(annotation);
    const existing = existingBySlot.get(slotName);
    if (existing?.getAttribute(SIGNATURE_ATTR) === signature) continue;

    const content = renderAnnotation(annotation);
    if (existing) {
      existing.replaceChildren(content);
      existing.setAttribute(SIGNATURE_ATTR, signature);
      continue;
    }

    const wrapper = createAnnotationWrapperNode(slotName);
    wrapper.classList.add("context-queue-annotation-slot");
    wrapper.setAttribute(SIGNATURE_ATTR, signature);
    wrapper.appendChild(content);
    host.appendChild(wrapper);
  }
}
