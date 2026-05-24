import { readdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { basename, join } from "node:path";
import type { AgentAdapter } from "./types.js";

function sanitizeClaudeProjectKey(cwd: string): string {
  return cwd.replace(/[^a-zA-Z0-9]/g, "-");
}

function newestJsonlSessionId(dir: string): string | null {
  let best: { id: string; mtimeMs: number } | null = null;
  try {
    for (const name of readdirSync(dir)) {
      if (!name.endsWith(".jsonl")) continue;
      const full = join(dir, name);
      const st = statSync(full);
      if (!best || st.mtimeMs > best.mtimeMs) {
        best = { id: name.slice(0, -".jsonl".length), mtimeMs: st.mtimeMs };
      }
    }
  } catch {
    return null;
  }
  return best?.id ?? null;
}

export const claudeAdapter: AgentAdapter = {
  kind: "claude",
  binaries: ["claude"],
  resumeArgs(sessionId) {
    return ["claude", "--resume", sessionId];
  },
  findLatestSessionId(cwd, home) {
    const projectDir = join(home, ".claude", "projects", sanitizeClaudeProjectKey(cwd));
    return newestJsonlSessionId(projectDir);
  },
};

function walkCodexSessions(root: string): string[] {
  const files: string[] = [];
  const stack = [root];
  while (stack.length > 0) {
    const dir = stack.pop()!;
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      continue;
    }
    for (const name of entries) {
      const full = join(dir, name);
      let st;
      try {
        st = statSync(full);
      } catch {
        continue;
      }
      if (st.isDirectory()) {
        stack.push(full);
      } else if (name.endsWith(".jsonl")) {
        files.push(full);
      }
    }
  }
  return files;
}

function codexSessionIdFromPath(path: string): string | null {
  const base = basename(path, ".jsonl");
  const rollout = base.match(/^rollout-(.+)$/);
  if (rollout) return rollout[1]!;
  const uuid = base.match(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  );
  return uuid?.[0] ?? null;
}

export const codexAdapter: AgentAdapter = {
  kind: "codex",
  binaries: ["codex"],
  resumeArgs(sessionId) {
    return ["codex", "resume", sessionId];
  },
  findLatestSessionId(_cwd, home) {
    const root = join(home, ".codex", "sessions");
    let best: { id: string; mtimeMs: number } | null = null;
    for (const file of walkCodexSessions(root)) {
      const id = codexSessionIdFromPath(file);
      if (!id) continue;
      const mtimeMs = statSync(file).mtimeMs;
      if (!best || mtimeMs > best.mtimeMs) {
        best = { id, mtimeMs };
      }
    }
    return best?.id ?? null;
  },
};

export const AGENT_ADAPTERS: AgentAdapter[] = [claudeAdapter, codexAdapter];

export function defaultAgentHome(): string {
  return homedir();
}
