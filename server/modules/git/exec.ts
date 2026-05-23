import { execFileSync } from "node:child_process";

export class GitError extends Error {
  constructor(
    message: string,
    readonly stderr: string,
  ) {
    super(message);
    this.name = "GitError";
  }
}

export function runGit(
  repoPath: string,
  args: string[],
  options?: { trim?: boolean },
): string {
  try {
    const out = execFileSync("git", ["-C", repoPath, ...args], {
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return options?.trim === false ? out : out.trim();
  } catch (err) {
    const e = err as { stderr?: Buffer | string; message?: string };
    const stderr =
      typeof e.stderr === "string"
        ? e.stderr
        : (e.stderr?.toString("utf-8") ?? e.message ?? "git failed");
    throw new GitError(stderr.trim() || "git command failed", stderr.trim());
  }
}

export function isGitRepo(repoPath: string): boolean {
  try {
    runGit(repoPath, ["rev-parse", "--git-dir"]);
    return true;
  } catch {
    return false;
  }
}
