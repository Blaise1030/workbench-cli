/** Decode a `file://` URI from drag-and-drop into a local path. */
export function fileUrlToPath(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed.startsWith("file://")) return null;
  try {
    return decodeURIComponent(new URL(trimmed).pathname);
  } catch {
    const withoutHost = trimmed.replace(/^file:\/\/[^/]*/, "");
    return decodeURIComponent(withoutHost || "/");
  }
}

/** Shell-safe quoting for a single path segment. */
export function shellQuotePath(path: string): string {
  if (/^[A-Za-z0-9_@%+=:,./-]+$/.test(path)) return path;
  return `'${path.replace(/'/g, "'\\''")}'`;
}

const PATH_LIKE = /^(\/|[A-Za-z]:\\)/;

export type DropPathOptions = {
  /** Worktree root on disk — used to resolve relative paths from the file tree. */
  worktreeRoot?: string;
  /** Relative paths in the worktree — used to resolve bare filenames from `Files` drops. */
  fileTreePaths?: readonly string[];
};

/** File objects from some desktop shells expose a local `.path`. */
type FileWithPath = File & { path?: string };

/** Cached during dragover — `getData` can be empty on drop for some macOS drags. */
export type DropPayloadCache = {
  uriList: string;
  plain: string;
};

let activeDragPayload: DropPayloadCache | null = null;

export function captureDragPayload(dt: DataTransfer): void {
  activeDragPayload = {
    uriList: dt.getData("text/uri-list"),
    plain: dt.getData("text/plain"),
  };
}

export function clearDragPayload(): void {
  activeDragPayload = null;
}

function addPath(paths: string[], seen: Set<string>, candidate: string) {
  const trimmed = candidate.trim();
  if (!trimmed || seen.has(trimmed)) return;
  seen.add(trimmed);
  paths.push(trimmed);
}

function unquotePath(candidate: string): string {
  const trimmed = candidate.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

export function isAbsolutePath(candidate: string): boolean {
  return PATH_LIKE.test(candidate);
}

/** Join a worktree-relative path to the worktree root. */
export function resolveRelativeToWorktreeRoot(
  relative: string,
  worktreeRoot: string,
): string {
  const rel = relative.replace(/^\.\//, "").replace(/^\/+/, "");
  const base = worktreeRoot.replace(/\/+$/, "");
  return rel ? `${base}/${rel}` : base;
}

function looksLikeRelativeFilePath(candidate: string): boolean {
  if (!candidate || candidate.includes("://")) return false;
  if (candidate.startsWith("#")) return false;
  return true;
}

/** Resolve a basename to one full path using the indexed file tree. */
export function resolveBasenameInFileTree(
  basename: string,
  fileTreePaths: readonly string[],
  worktreeRoot: string,
): string | null {
  const matches = fileTreePaths.filter(
    (p) => p === basename || p.endsWith(`/${basename}`),
  );
  if (matches.length !== 1) return null;
  return resolveRelativeToWorktreeRoot(matches[0]!, worktreeRoot);
}

/** Resolve a single line from uri-list or text/plain into a local path, if possible. */
export function pathFromDropLine(
  line: string,
  options?: DropPathOptions,
): string | null {
  const trimmed = unquotePath(line);
  if (!trimmed || trimmed.startsWith("#")) return null;
  const fromFileUrl = fileUrlToPath(trimmed);
  if (fromFileUrl) return fromFileUrl;
  if (isAbsolutePath(trimmed)) return trimmed;
  const root = options?.worktreeRoot;
  if (root && looksLikeRelativeFilePath(trimmed)) {
    return resolveRelativeToWorktreeRoot(trimmed, root);
  }
  return null;
}

function pathsFromLines(
  paths: string[],
  seen: Set<string>,
  text: string,
  options?: DropPathOptions,
): void {
  for (const line of text.split(/\r?\n/)) {
    const path = pathFromDropLine(line, options);
    if (path) addPath(paths, seen, path);
  }
}

function pathFromFile(file: File): string | null {
  const withPath = file as FileWithPath;
  if (typeof withPath.path === "string" && withPath.path.trim()) {
    return withPath.path;
  }
  return null;
}

/** Extract local file paths from a browser DataTransfer (best-effort). */
export function pathsFromDataTransfer(
  dt: DataTransfer,
  options?: DropPathOptions,
): string[] {
  const paths: string[] = [];
  const seen = new Set<string>();

  const uriList =
    dt.getData("text/uri-list") || activeDragPayload?.uriList || "";
  if (uriList) pathsFromLines(paths, seen, uriList, options);

  if (!paths.length) {
    const plain = dt.getData("text/plain") || activeDragPayload?.plain || "";
    if (plain) pathsFromLines(paths, seen, plain, options);
  }

  if (!paths.length && dt.files?.length) {
    const root = options?.worktreeRoot;
    const tree = options?.fileTreePaths;
    for (let i = 0; i < dt.files.length; i++) {
      const file = dt.files[i];
      if (!file) continue;
      const absolute = pathFromFile(file);
      if (absolute) {
        addPath(paths, seen, absolute);
        continue;
      }
      if (root && tree?.length) {
        const fromTree = resolveBasenameInFileTree(file.name, tree, root);
        if (fromTree) {
          addPath(paths, seen, fromTree);
          continue;
        }
      }
      addPath(paths, seen, file.name);
    }
  }

  return paths;
}

/** Plain text drop when no file paths were resolved. */
export function plainTextFromDataTransfer(
  dt: DataTransfer,
  options?: DropPathOptions,
): string | null {
  if (pathsFromDataTransfer(dt, options).length > 0) return null;
  const plain = (dt.getData("text/plain") || activeDragPayload?.plain || "").trim();
  return plain || null;
}

export function formatPathsForTerminal(paths: string[]): string {
  return `${paths.map(shellQuotePath).join(" ")} `;
}

export function hasDroppableData(dt: DataTransfer | null): boolean {
  if (!dt) return false;
  if (dt.types.includes("Files")) return true;
  if (dt.types.includes("text/uri-list")) return true;
  if (dt.types.includes("text/plain")) return true;
  return false;
}
