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

function addPath(paths: string[], seen: Set<string>, candidate: string) {
  const trimmed = candidate.trim();
  if (!trimmed || seen.has(trimmed)) return;
  seen.add(trimmed);
  paths.push(trimmed);
}

/** Extract local file paths from a browser DataTransfer (best-effort). */
export function pathsFromDataTransfer(dt: DataTransfer): string[] {
  const paths: string[] = [];
  const seen = new Set<string>();

  const uriList = dt.getData("text/uri-list");
  if (uriList) {
    for (const line of uriList.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const path = fileUrlToPath(trimmed);
      if (path) addPath(paths, seen, path);
    }
  }

  if (!paths.length) {
    const plain = dt.getData("text/plain");
    if (plain) {
      for (const line of plain.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (PATH_LIKE.test(trimmed)) addPath(paths, seen, trimmed);
      }
    }
  }

  if (!paths.length && dt.files?.length) {
    for (let i = 0; i < dt.files.length; i++) {
      const file = dt.files[i];
      if (file) addPath(paths, seen, file.name);
    }
  }

  return paths;
}

/** Plain text drop when no file paths were resolved. */
export function plainTextFromDataTransfer(dt: DataTransfer): string | null {
  if (pathsFromDataTransfer(dt).length > 0) return null;
  const plain = dt.getData("text/plain").trim();
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
