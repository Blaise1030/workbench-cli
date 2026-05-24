import { resolve, relative, isAbsolute } from "node:path";

export function assertPathWithinRoot(root: string, relativePath: string): string {
  const resolvedRoot = resolve(root);
  const resolvedPath = resolve(resolvedRoot, relativePath);
  const relativeToRoot = relative(resolvedRoot, resolvedPath);

  if (
    relativeToRoot === "" ||
    (!relativeToRoot.startsWith("..") && !isAbsolute(relativeToRoot))
  ) {
    return resolvedPath;
  }

  throw new Error(
    `Path escapes worktree: "${relativePath}" resolves outside "${resolvedRoot}"`,
  );
}
