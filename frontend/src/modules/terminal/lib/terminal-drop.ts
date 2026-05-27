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

/** True when the path is safe to paste into the shell without uploading. */
/** Normalize path strings so equivalent macOS paths dedupe (e.g. U+202F spaces). */
export function normalizeDropPathForCompare(path: string): string {
  return path.normalize("NFC").replace(/\u202f/g, " ");
}

/** Dedupe paths for one drop; keeps the first spelling (important for odd filename chars). */
export function dedupeDropPaths(paths: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const path of paths) {
    const key = normalizeDropPathForCompare(path);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(path);
  }
  return out;
}

export function isUsableDropPath(
  path: string,
  options?: DropPathOptions,
): boolean {
  if (isAbsolutePath(path)) return true;
  const root = options?.worktreeRoot;
  if (root) {
    if (path.startsWith(root)) return true;
    if (path.includes("/")) return true;
  }
  return false;
}

export function partitionDroppedFiles(
  files: Iterable<File>,
  options?: DropPathOptions,
): { resolved: string[]; needsUpload: File[] } {
  const resolved: string[] = [];
  const needsUpload: File[] = [];
  const seen = new Set<string>();
  for (const file of files) {
    const path = pathFromPickerFile(file, options);
    if (isUsableDropPath(path, options)) {
      if (!seen.has(path)) {
        seen.add(path);
        resolved.push(path);
      }
    } else {
      needsUpload.push(file);
    }
  }
  return { resolved, needsUpload };
}

/** Merge `files` from useDropZone and `DataTransfer.files` without duplicates. */
export function mergeDropFiles(
  fromDropZone: File[] | null | undefined,
  dataTransfer: DataTransfer | null | undefined,
): File[] {
  const out: File[] = [];
  const seen = new Set<string>();
  for (const file of [...(fromDropZone ?? []), ...(dataTransfer?.files ?? [])]) {
    const key = `${file.name}:${file.size}:${file.lastModified}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(file);
  }
  return out;
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

/** Resolve a picked or dropped File to a path string for the terminal. */
export function pathFromPickerFile(
  file: File,
  options?: DropPathOptions,
): string {
  const relative = file.webkitRelativePath?.replace(/\\/g, "/").trim();
  if (relative && options?.worktreeRoot) {
    return resolveRelativeToWorktreeRoot(relative, options.worktreeRoot);
  }
  if (relative) return relative;

  const absolute = pathFromFile(file);
  if (absolute) return absolute;

  const root = options?.worktreeRoot;
  const tree = options?.fileTreePaths;
  if (root && tree?.length) {
    const fromTree = resolveBasenameInFileTree(file.name, tree, root);
    if (fromTree) return fromTree;
  }

  return file.name;
}

/** Paths from a file picker or DataTransfer file list (no upload). */
export function pathsFromFileList(
  files: Iterable<File>,
  options?: DropPathOptions,
): string[] {
  const paths: string[] = [];
  const seen = new Set<string>();
  for (const file of files) {
    addPath(paths, seen, pathFromPickerFile(file, options));
  }
  return paths;
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
    for (const path of pathsFromFileList(dt.files, options)) {
      addPath(paths, seen, path);
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
  const plain = (
    dt.getData("text/plain") ||
    activeDragPayload?.plain ||
    ""
  ).trim();
  return plain || null;
}

export function formatPathsForTerminal(paths: string[]): string {
  return `${paths.map(shellQuotePath).join(" ")} `;
}

export function hasDroppableTypes(types: DOMStringList | readonly string[]): boolean {
  if (types.includes("Files")) return true;
  if (types.includes("text/uri-list")) return true;
  if (types.includes("text/plain")) return true;
  return false;
}

/** Validate drops via DataTransferItemList (for VueUse `useDropZone` `checkValidity`). */
export function checkDroppableItems(items: DataTransferItemList): boolean {
  const list = Array.from(items);
  if (!list.length) return false;
  for (const item of list) {
    if (item.kind === "file") return true;
    const type = item.type;
    if (type === "text/plain" || type === "text/uri-list") return true;
  }
  return false;
}
