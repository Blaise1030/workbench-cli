/** Relative path tab helpers — state is scoped per worktree in file-explorer storage. */

export function basename(relativePath: string): string {
  const parts = relativePath.split("/").filter(Boolean);
  return parts.at(-1) ?? relativePath;
}

/** Add a tab if missing; re-selecting keeps stable tab order. */
export function openFileTab(openFiles: string[] | undefined, relativePath: string): string[] {
  const list = openFiles ?? [];
  if (list.includes(relativePath)) return list;
  return [...list, relativePath];
}

export function closeFileTab(openFiles: string[] | undefined, relativePath: string): string[] {
  return (openFiles ?? []).filter((p) => p !== relativePath);
}

/** Tab to activate after closing `closedPath` (prefer right neighbor, else left). */
export function adjacentFileAfterClose(
  openFiles: string[],
  closedPath: string,
): string | null {
  const idx = openFiles.indexOf(closedPath);
  if (idx === -1) return openFiles.at(-1) ?? null;
  const remaining = openFiles.filter((p) => p !== closedPath);
  if (remaining.length === 0) return null;
  return remaining[Math.min(idx, remaining.length - 1)] ?? null;
}

export function seedOpenFiles(
  openFiles: string[] | undefined,
  lastFilePath: string | undefined,
): string[] {
  if (openFiles?.length) return openFiles;
  if (lastFilePath) return [lastFilePath];
  return [];
}

/** Drop tabs whose files no longer exist in the worktree listing. */
export function pruneOpenFiles(openFiles: string[] | undefined, pathSet: Set<string>): string[] {
  return (openFiles ?? []).filter((p) => pathSet.has(p));
}
