import type { ILink, ILinkProvider, Terminal } from "@xterm/xterm";

const PATH_RE = /\/[^\s\x00-\x1f'"<>()\[\]{}]+/g;
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
 * Scans a single line of terminal text for absolute paths under worktreePath.
 * Pure function — no xterm dependency, fully unit-testable.
 */
export function extractFilePaths(lineText: string, worktreePath: string): FileLinkMatch[] {
  if (!worktreePath) return [];
  const prefix = worktreePath.endsWith("/") ? worktreePath : `${worktreePath}/`;
  const results: FileLinkMatch[] = [];

  for (const match of lineText.matchAll(new RegExp(PATH_RE.source, "g"))) {
    const raw = match[0].replace(/:+$/, "");
    const clean = raw.replace(LINE_COL_RE, "");
    if (!clean.startsWith(prefix)) continue;
    const startX = match.index!;
    results.push({ path: clean, text: raw, startX, endX: startX + raw.length });
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
): ILinkProvider {
  return {
    provideLinks(y: number, callback: (links: ILink[] | undefined) => void): void {
      const line = terminal.buffer.active.getLine(y - 1);
      if (!line) {
        callback(undefined);
        return;
      }
      const text = line.translateToString(true);
      const matches = extractFilePaths(text, getWorktreePath());
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
