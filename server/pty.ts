export function parseResize(msg: string): { cols: number; rows: number } | null {
  const match = msg.match(/^\x1b\[RESIZE:(\d+);(\d+)\]$/);
  if (!match) return null;
  return { cols: parseInt(match[1], 10), rows: parseInt(match[2], 10) };
}
