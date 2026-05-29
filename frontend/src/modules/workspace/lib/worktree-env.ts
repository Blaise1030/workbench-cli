/** SPA route for a worktree (same origin, relative path). */
export function worktreePath(worktreeId: string): string {
  return `/w/${encodeURIComponent(worktreeId)}`;
}

export function currentBrowserPort(): number {
  const fromLocation = window.location.port;
  if (fromLocation) return parseInt(fromLocation, 10);
  return window.location.protocol === "https:" ? 443 : 80;
}
