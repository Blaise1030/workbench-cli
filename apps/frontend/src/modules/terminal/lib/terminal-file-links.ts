import type { ILink, ILinkProvider, Terminal } from "@xterm/xterm";

const ABS_PATH_RE = /\/[^\s\x00-\x1f'"<>()\[\]{}]+/g;
const REL_PATH_RE = /[a-zA-Z0-9._-][^\s\x00-\x1f'"<>()\[\]{}]*\/[^\s\x00-\x1f'"<>()\[\]{}]*/g;
const LINE_COL_RE = /(?::\d+(?::\d+)?)?:*$/;

export interface FileLinkMatch {
  /** Absolute path with :line:col stripped. */
  path: string;
  /** Raw matched text including any :line:col suffix. */
  text: string;
  /** 0-indexed column where the match starts in the line string. */
  startX: number;
  /** 0-indexed column immediately after the last char of the match. */
  endX: number;
}

/**
 * Scans a single line of terminal text for file paths under worktreePath.
 * Matches absolute paths (filtered by prefix), repo-root-relative paths with a
 * leading slash (filtered by filePathSet), and relative paths (filtered by filePathSet).
 * Pure function — no xterm dependency, fully unit-testable.
 */
export function extractFilePaths(
  lineText: string,
  worktreePath: string,
  filePathSet?: Set<string>,
): FileLinkMatch[] {
  if (!worktreePath) return [];
  const prefix = worktreePath.endsWith("/") ? worktreePath : `${worktreePath}/`;
  const results: FileLinkMatch[] = [];
  const seenRanges = new Set<number>();

  function overlapsExisting(startX: number, endX: number): boolean {
    return results.some((r) => startX < r.endX && endX > r.startX);
  }

  for (const match of lineText.matchAll(new RegExp(ABS_PATH_RE.source, "g"))) {
    const raw = match[0].replace(/:+$/, "");
    const clean = raw.replace(LINE_COL_RE, "");
    const startX = match.index!;

    if (clean.startsWith(prefix)) {
      seenRanges.add(startX);
      results.push({ path: clean, text: raw, startX, endX: startX + raw.length });
      continue;
    }

    // Repo-root-relative paths often appear with a leading slash (e.g. /landing/public/foo.png).
    if (filePathSet && filePathSet.size > 0 && clean.startsWith("/")) {
      const relative = clean.slice(1);
      if (filePathSet.has(relative)) {
        seenRanges.add(startX);
        results.push({
          path: `${prefix}${relative}`,
          text: raw,
          startX,
          endX: startX + raw.length,
        });
      }
    }
  }

  if (filePathSet && filePathSet.size > 0) {
    for (const match of lineText.matchAll(new RegExp(REL_PATH_RE.source, "g"))) {
      const startX = match.index!;
      const raw = match[0].replace(/:+$/, "");
      const endX = startX + raw.length;
      if (seenRanges.has(startX) || overlapsExisting(startX, endX)) continue;
      const clean = raw.replace(LINE_COL_RE, "");
      if (!filePathSet.has(clean)) continue;
      results.push({ path: `${prefix}${clean}`, text: raw, startX, endX: startX + raw.length });
    }
  }

  return results;
}

/**
 * Creates an xterm ILinkProvider that highlights file paths in terminal output.
 */
export function createFileLinkProvider(
  terminal: Terminal,
  getWorktreePath: () => string,
  onActivate: (path: string) => void,
  getFilePaths?: () => string[] | undefined,
): ILinkProvider {
  return {
    provideLinks(y: number, callback: (links: ILink[] | undefined) => void): void {
      const line = terminal.buffer.active.getLine(y - 1);
      if (!line) {
        callback(undefined);
        return;
      }
      const text = line.translateToString(true);
      const filePathSet = getFilePaths ? new Set(getFilePaths() ?? []) : undefined;
      const matches = extractFilePaths(text, getWorktreePath(), filePathSet);
      if (matches.length === 0) {
        callback(undefined);
        return;
      }
      callback(
        matches.map((m): ILink => ({
          // xterm range uses 1-indexed columns; end is inclusive last char
          range: {
            start: { x: m.startX + 1, y },
            end: { x: m.endX, y },
          },
          text: m.text,
          activate(_event: MouseEvent, _text: string): void {
            onActivate(m.path);
          },
        })),
      );
    },
  };
}
