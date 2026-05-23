import { existsSync } from "node:fs";
import { runGit } from "./exec.js";

export interface GitWorktreeEntry {
  path: string;
  head?: string;
  branch?: string;
  gitDir?: string;
}

export function parseWorktreePorcelain(output: string): GitWorktreeEntry[] {
  const entries: GitWorktreeEntry[] = [];
  let current: Partial<GitWorktreeEntry> = {};

  const flush = () => {
    if (current.path) {
      entries.push({
        path: current.path,
        head: current.head,
        branch: current.branch?.replace(/^refs\/heads\//, ""),
        gitDir: current.gitDir,
      });
    }
    current = {};
  };

  for (const line of output.split("\n")) {
    if (!line.trim()) {
      flush();
      continue;
    }
    if (line.startsWith("worktree ")) {
      current.path = line.slice("worktree ".length).trim();
    } else if (line.startsWith("HEAD ")) {
      current.head = line.slice("HEAD ".length).trim();
    } else if (line.startsWith("branch ")) {
      current.branch = line.slice("branch ".length).trim();
    } else if (line.startsWith("gitdir ")) {
      current.gitDir = line.slice("gitdir ".length).trim();
    }
  }
  flush();
  return entries;
}

export function listWorktrees(repoPath: string): GitWorktreeEntry[] {
  const out = runGit(repoPath, ["worktree", "list", "--porcelain"]);
  return parseWorktreePorcelain(out);
}

export function listBranches(repoPath: string): string[] {
  const out = runGit(repoPath, [
    "branch",
    "--format=%(refname:short)",
  ]);
  return out
    .split("\n")
    .map((b) => b.trim())
    .filter(Boolean);
}

export function getDefaultBranch(repoPath: string): string {
  try {
    const sym = runGit(repoPath, ["symbolic-ref", "refs/remotes/origin/HEAD"]);
    const match = sym.match(/refs\/remotes\/origin\/(.+)/);
    if (match?.[1]) return match[1];
  } catch {
    // fall through
  }
  try {
    return runGit(repoPath, ["branch", "--show-current"]) || "main";
  } catch {
    const branches = listBranches(repoPath);
    return branches[0] ?? "main";
  }
}

export function branchExists(repoPath: string, branch: string): boolean {
  return listBranches(repoPath).includes(branch);
}

export function worktreePathExists(path: string): boolean {
  return existsSync(path);
}
