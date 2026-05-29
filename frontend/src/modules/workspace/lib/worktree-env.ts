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

export function buildWorktreeUrl(
  worktreeId: string,
  port: number,
  network: Pick<NetworkSettings, "host" | "scheme">,
): string {
  const url = new URL(`${network.scheme}://${network.host}`);
  url.port = String(port);
  url.pathname = `/w/${worktreeId}`;
  url.search = "";
  url.hash = "";
  return url.toString();
}

/** Full-page navigation when the target worktree needs the other port. Returns true if navigating away. */
export function navigateToWorktreeOnPortIfNeeded(
  worktreeId: string,
  targetPort: number,
  network: NetworkSettings,
): boolean {
  if (targetPort === currentBrowserPort()) return false;
  window.location.assign(buildWorktreeUrl(worktreeId, targetPort, network));
  return true;
}
