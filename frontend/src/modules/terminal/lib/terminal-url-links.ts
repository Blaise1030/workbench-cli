import type { ILink, ILinkProvider, Terminal } from "@xterm/xterm";

const URL_RE = /https?:\/\/(?:localhost|127\.0\.0\.1|\[::1\]):\d+(?:\/\S*)?/g;

export interface URLLinkMatch {
  url: string;
  startX: number;
  endX: number;
}

export function extractURLs(lineText: string): URLLinkMatch[] {
  const results: URLLinkMatch[] = [];
  for (const match of lineText.matchAll(new RegExp(URL_RE.source, "g"))) {
    const url = match[0];
    const startX = match.index!;
    results.push({ url, startX, endX: startX + url.length });
  }
  return results;
}

export function createURLLinkProvider(
  terminal: Terminal,
  onClick: (url: string, metaKey: boolean) => void,
): ILinkProvider {
  return {
    provideLinks(y: number, callback: (links: ILink[] | undefined) => void): void {
      const line = terminal.buffer.active.getLine(y - 1);
      if (!line) {
        callback(undefined);
        return;
      }
      const text = line.translateToString(true);
      const matches = extractURLs(text);
      if (matches.length === 0) {
        callback(undefined);
        return;
      }
      callback(
        matches.map((m): ILink => ({
          range: {
            start: { x: m.startX + 1, y },
            end: { x: m.endX, y },
          },
          text: m.url,
          activate(event: MouseEvent): void {
            onClick(m.url, event.metaKey || event.ctrlKey);
          },
        })),
      );
    },
  };
}
