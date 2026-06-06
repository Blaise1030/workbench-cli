export interface Project {
  id: string;
  name: string;
  repoPath: string;
  isGitRepo: boolean;
  createdAt: string;
}

export interface Worktree {
  id: string;
  projectId: string;
  path: string;
  branch: string | null;
  baseBranch: string | null;
  gitDir: string | null;
  isLinked: boolean;
  createdAt: string;
}
