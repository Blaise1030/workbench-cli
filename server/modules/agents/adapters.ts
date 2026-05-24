import { readdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { AgentAdapter } from "./types.js";
import {
  cursorWorkspaceHash,
  geminiProjectHash,
  isGeminiSessionFile,
  newestByMtime,
  normalizeCwd,
  readFirstJsonLine,
  sessionIdFromGeminiFile,
  walkFiles,
} from "./session-utils.js";

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

function codexSessionIdFromPath(path: string): string | null {
  const base = path.split("/").pop()?.replace(/\.jsonl$/, "") ?? "";
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
    const files = walkFiles(root, (name) => name.endsWith(".jsonl"));
    const candidates = files
      .map((file) => {
        const id = codexSessionIdFromPath(file);
        if (!id) return null;
        return { id, mtimeMs: statSync(file).mtimeMs };
      })
      .filter((item): item is { id: string; mtimeMs: number } => item !== null);
    return newestByMtime(candidates)?.id ?? null;
  },
};

function findLatestCursorSessionInWorkspace(workspaceDir: string): string | null {
  let entries: string[];
  try {
    entries = readdirSync(workspaceDir);
  } catch {
    return null;
  }

  const candidates = entries
    .map((chatId) => {
      const storeDb = join(workspaceDir, chatId, "store.db");
      try {
        return { id: chatId, mtimeMs: statSync(storeDb).mtimeMs };
      } catch {
        return null;
      }
    })
    .filter((item): item is { id: string; mtimeMs: number } => item !== null);

  return newestByMtime(candidates)?.id ?? null;
}

export const cursorAdapter: AgentAdapter = {
  kind: "cursor",
  binaries: ["agent", "cursor-agent"],
  resumeArgs(sessionId) {
    return ["agent", "--resume", sessionId];
  },
  findLatestSessionId(cwd, home) {
    const workspaceDir = join(home, ".cursor", "chats", cursorWorkspaceHash(cwd));
    const direct = findLatestCursorSessionInWorkspace(workspaceDir);
    if (direct) return direct;

    const root = join(home, ".cursor", "chats");
    let workspaces: string[];
    try {
      workspaces = readdirSync(root);
    } catch {
      return null;
    }

    const candidates = workspaces
      .map((workspaceId) => {
        const chatId = findLatestCursorSessionInWorkspace(join(root, workspaceId));
        if (!chatId) return null;
        const storeDb = join(root, workspaceId, chatId, "store.db");
        try {
          return { id: chatId, mtimeMs: statSync(storeDb).mtimeMs };
        } catch {
          return null;
        }
      })
      .filter((item): item is { id: string; mtimeMs: number } => item !== null);

    return newestByMtime(candidates)?.id ?? null;
  },
};

function geminiSessionsForProject(cwd: string, home: string): string[] {
  const resolved = normalizeCwd(cwd);
  const hash = geminiProjectHash(resolved);
  const directDir = join(home, ".gemini", "tmp", hash, "chats");
  const direct = walkFiles(directDir, isGeminiSessionFile);
  if (direct.length > 0) return direct;

  const root = join(home, ".gemini", "tmp");
  const all = walkFiles(root, isGeminiSessionFile);
  return all.filter((file) => {
    const meta = readFirstJsonLine(file);
    return meta?.projectHash === hash;
  });
}

export const geminiAdapter: AgentAdapter = {
  kind: "gemini",
  binaries: ["gemini"],
  resumeArgs(sessionId) {
    return ["gemini", "--resume", sessionId];
  },
  findLatestSessionId(cwd, home) {
    const files = geminiSessionsForProject(cwd, home);
    const candidates = files
      .map((file) => {
        const id = sessionIdFromGeminiFile(file);
        if (!id) return null;
        return { id, mtimeMs: statSync(file).mtimeMs };
      })
      .filter((item): item is { id: string; mtimeMs: number } => item !== null);
    return newestByMtime(candidates)?.id ?? null;
  },
};

export const AGENT_ADAPTERS: AgentAdapter[] = [
  claudeAdapter,
  codexAdapter,
  cursorAdapter,
  geminiAdapter,
];

export function defaultAgentHome(): string {
  return homedir();
}
