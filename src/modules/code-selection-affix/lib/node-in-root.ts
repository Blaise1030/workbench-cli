/** Whether `node` lies inside `root`, including shadow DOM descendants. */
export function nodeInRoot(root: HTMLElement, node: Node | null): boolean {
  let current: Node | null = node;
  while (current) {
    if (current === root) return true;
    if (current instanceof HTMLElement) {
      const rootNode = current.getRootNode();
      if (rootNode instanceof ShadowRoot) {
        current = rootNode.host;
        continue;
      }
    }
    current = current.parentNode;
  }
  return false;
}
