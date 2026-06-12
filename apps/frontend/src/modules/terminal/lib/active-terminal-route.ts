/**
 * Decide whether the routed terminal must be redirected because it no longer
 * exists in its worktree's terminal list (e.g. the tab was closed). Returns the
 * fallback terminalId to navigate to, or `null` to leave the route untouched.
 *
 * `list` MUST be the terminal list for the SAME worktree the route currently
 * points at. Passing a stale list from a previously-active worktree is what
 * caused tabs to jump to the first item when switching worktrees: the freshly
 * selected terminal isn't in the old worktree's list, so it looked "deleted"
 * and got bounced to `list[0]`. Read the list for `route.params.worktreeId`
 * straight from the query cache rather than the lagging reactive query data.
 */
export function fallbackTerminalIdForRoute(
  list: readonly { id: string }[] | undefined,
  terminalId: string | undefined,
): string | null {
  if (!list || !terminalId) return null;
  if (list.some((t) => t.id === terminalId)) return null;
  return list[0]?.id ?? null;
}
