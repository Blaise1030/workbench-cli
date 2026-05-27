import {
  createAnnotationWrapperNode,
  getLineAnnotationName,
  type CodeViewItem,
} from "@pierre/diffs";
import type { StoredContextQueueAnnotation } from "@/modules/context-queue/lib/context-queue-annotations-state";

/** Pierre skips renderAnnotations() when CodeView owns the container; fill slots ourselves. */
export function syncPierreAnnotationSlotsForHost(
  host: HTMLElement,
  item: CodeViewItem,
  renderAnnotation: (annotation: StoredContextQueueAnnotation) => HTMLElement,
) {
  for (const el of host.querySelectorAll(
    "[data-annotation-slot], .context-queue-annotation-slot",
  )) {
    el.remove();
  }

  for (const annotation of item.annotations ?? []) {
    const slotName = getLineAnnotationName(annotation);
    const wrapper = createAnnotationWrapperNode(slotName);
    wrapper.classList.add("context-queue-annotation-slot");
    wrapper.appendChild(renderAnnotation(annotation));
    host.appendChild(wrapper);
  }
}
