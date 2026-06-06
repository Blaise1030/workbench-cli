const DIFFS_HOST = "diffs-container";
const GIT_CHECKBOX = "git-diff-select-checkbox";

function nodeInRoot(root: HTMLElement, node: Node | null): boolean {
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

/** Text selected inside a code view root (empty if none or outside root). */
export function selectionTextInRoot(root: HTMLElement | null): string {
  if (!root) return "";
  const sel = document.getSelection();
  if (!sel || sel.isCollapsed || !sel.toString().trim()) return "";
  const anchor = sel.anchorNode;
  const focus = sel.focusNode;
  if (!anchor || !focus) return "";
  if (!nodeInRoot(root, anchor) || !nodeInRoot(root, focus)) return "";
  return sel.toString();
}

export function filePathFromDiffHost(
  root: HTMLElement,
  itemIds: readonly string[],
  host: HTMLElement,
): string | undefined {
  const hosts = root.querySelectorAll(DIFFS_HOST);
  const index = Array.from(hosts).indexOf(host);
  if (index < 0 || index >= itemIds.length) return undefined;
  return itemIds[index];
}

function hostElementFromNode(
  root: HTMLElement,
  node: Node | null,
): HTMLElement | null {
  let current: Node | null = node;
  while (current && current !== root) {
    if (current instanceof HTMLElement) {
      if (current.tagName.toLowerCase() === DIFFS_HOST) return current;
      const rootNode = current.getRootNode();
      if (rootNode instanceof ShadowRoot) {
        const host = rootNode.host;
        if (host instanceof HTMLElement) {
          if (host.tagName.toLowerCase() === DIFFS_HOST) return host;
          current = host;
          continue;
        }
      }
    }
    current = current.parentNode;
  }
  return null;
}

export function findDiffsHost(
  root: HTMLElement,
  node: Node | null,
): HTMLElement | null {
  return hostElementFromNode(root, node);
}

export function resolveExplorerPath(
  worktreePath: string,
  fileQueryEncoded: string | undefined,
): string | null {
  if (!fileQueryEncoded) return null;
  try {
    const fullPath = decodeURIComponent(fileQueryEncoded);
    const prefix = worktreePath.endsWith("/")
      ? worktreePath
      : `${worktreePath}/`;
    if (!fullPath.startsWith(prefix)) return null;
    return fullPath.slice(prefix.length);
  } catch {
    return null;
  }
}

function singleCheckedGitPath(root: HTMLElement): string | undefined {
  const checked = root.querySelectorAll<HTMLInputElement>(
    `input.${GIT_CHECKBOX}:checked[data-git-diff-file-path]`,
  );
  if (checked.length !== 1) return undefined;
  return checked[0]?.dataset.gitDiffFilePath?.trim() || undefined;
}

export function resolveGitContext(opts: {
  root: HTMLElement;
  itemIds: readonly string[];
}): { relativePath?: string; selection: string } {
  const selection = selectionTextInRoot(opts.root).trim();
  const anchor = document.getSelection()?.anchorNode ?? null;
  const host = findDiffsHost(opts.root, anchor);
  if (host) {
    const fromHost = filePathFromDiffHost(opts.root, opts.itemIds, host);
    if (fromHost) return { relativePath: fromHost, selection };
  }
  const fromCheckbox = singleCheckedGitPath(opts.root);
  if (fromCheckbox) return { relativePath: fromCheckbox, selection };
  if (opts.itemIds.length === 1) {
    return { relativePath: opts.itemIds[0], selection };
  }
  return { selection };
}

export function resolveExplorerContext(opts: {
  root: HTMLElement;
  worktreePath: string;
  fileQueryEncoded?: string;
}): { relativePath?: string; selection: string } {
  const selection = selectionTextInRoot(opts.root).trim();
  const relativePath =
    resolveExplorerPath(opts.worktreePath, opts.fileQueryEncoded) ?? undefined;
  return { relativePath, selection };
}
