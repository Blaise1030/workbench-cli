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

function readGitOutput(
  chunk: string | Buffer | undefined,
  fallback: string,
): string {
  if (typeof chunk === "string") return chunk;
  return chunk?.toString("utf-8") ?? fallback;
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
    const e = err as {
      status?: number;
      stdout?: string | Buffer;
      stderr?: string | Buffer;
      message?: string;
    };
    const stderr = readGitOutput(e.stderr, e.message ?? "git failed").trim();
    throw new GitError(stderr || "git command failed", stderr);
  }
}

/** Like runGit, but treats exit code 1 with stdout as success (e.g. `git diff`). */
export function runGitWithStdout(
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
    const e = err as {
      status?: number;
      stdout?: string | Buffer;
      stderr?: string | Buffer;
      message?: string;
    };
    const stdout = readGitOutput(e.stdout, "");
    if (e.status === 1 && stdout) {
      return options?.trim === false ? stdout : stdout.trim();
    }
    const stderr = readGitOutput(e.stderr, e.message ?? "git failed").trim();
    throw new GitError(stderr || "git command failed", stderr);
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
