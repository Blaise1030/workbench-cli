import type { NetworkSettings } from "@server/schemas/api";

/** True when the worktree tracks the repo's default (prod) branch. */
export function isProdWorktreeBranch(
  branch: string | null | undefined,
  defaultBranch: string,
): boolean {
  if (!branch) return true;
  return branch === defaultBranch;
}

export function portForWorktreeBranch(
  isProd: boolean,
  network: Pick<NetworkSettings, "prodPort" | "nonProdPort">,
): number {
  return isProd ? network.prodPort : network.nonProdPort;
}

export function currentBrowserPort(): number {
  const fromLocation = window.location.port;
  if (fromLocation) return parseInt(fromLocation, 10);
  return window.location.protocol === "https:" ? 443 : 80;
}

/** SPA route for a worktree (same origin). */
export function worktreePath(worktreeId: string): string {
  return `/w/${encodeURIComponent(worktreeId)}`;
}

/**
 * Full-page navigation when the worktree lives on the other prod/non-prod port.
 * Uses a relative path; only the port (and host from the current page) changes.
 * Returns true if navigating away.
 */
export function navigateToWorktreeOnPortIfNeeded(
  worktreeId: string,
  targetPort: number,
): boolean {
  if (targetPort === currentBrowserPort()) return false;
  const { protocol, hostname } = window.location;
  window.location.assign(
    `${protocol}//${hostname}:${targetPort}${worktreePath(worktreeId)}`,
  );
  return true;
}
