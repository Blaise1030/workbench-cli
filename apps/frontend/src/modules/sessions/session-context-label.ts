export interface SessionContext {
  projectName: string;
  branch: string | null;
}

/**
 * Builds the "projectName · branch" label shown under a session in the
 * sidebar. Self-contained: depends only on the session payload, not on the
 * projects/worktrees queries.
 */
export function sessionContextLabel({ projectName, branch }: SessionContext): string {
  if (!projectName) return "";
  return branch ? `${projectName} · ${branch}` : projectName;
}
