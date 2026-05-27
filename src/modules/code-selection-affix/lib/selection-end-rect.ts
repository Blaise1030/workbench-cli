import { nodeInRoot } from "@/modules/code-selection-affix/lib/node-in-root";
import type { Rect } from "@/modules/code-selection-affix/lib/context-queue-anchor";

export { nodeInRoot };

function domRectToAnchor(rect: DOMRect): Rect | null {
  if (rect.width === 0 && rect.height === 0) return null;
  return {
    left: rect.left,
    top: rect.top,
    width: rect.width,
    height: rect.height,
  };
}

/** Selection bounding box in viewport coords, scoped to `root`. */
export function selectionAnchorRect(root: HTMLElement | null): Rect | null {
  if (!root) return null;
  const sel = document.getSelection();
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return null;

  const anchorNode = sel.anchorNode;
  const focusNode = sel.focusNode;
  if (!anchorNode || !focusNode) return null;
  if (!nodeInRoot(root, anchorNode) || !nodeInRoot(root, focusNode)) {
    return null;
  }

  const range = sel.getRangeAt(0);
  return domRectToAnchor(range.getBoundingClientRect());
}
