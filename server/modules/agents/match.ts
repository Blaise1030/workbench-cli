import { AGENT_ADAPTERS } from "./adapters.js";
import type { AgentAdapter, AgentKind } from "./types.js";

export function extractInvocation(commandLine: string): string | null {
  let trimmed = commandLine.trim();
  if (!trimmed) return null;

  for (let i = 0; i < 8; i++) {
    const withoutAssignments = trimmed.replace(/^(?:\s*[A-Za-z_][A-Za-z0-9_]*=\S*\s*)+/, "");
    if (withoutAssignments !== trimmed) {
      trimmed = withoutAssignments.trimStart();
      continue;
    }
    if (trimmed.startsWith("env ")) {
      trimmed = trimmed.slice(4).trimStart();
      continue;
    }
    break;
  }

  const match = trimmed.match(/^([^\s|;&]+)/);
  if (!match) return null;
  const token = match[1]!;
  return token.includes("/") ? token.slice(token.lastIndexOf("/") + 1) : token;
}

export function matchAgentAdapter(commandLine: string): AgentAdapter | null {
  const invocation = extractInvocation(commandLine);
  if (!invocation) return null;
  return AGENT_ADAPTERS.find((adapter) => adapter.binaries.includes(invocation)) ?? null;
}

export function getAgentAdapter(kind: AgentKind): AgentAdapter | undefined {
  return AGENT_ADAPTERS.find((adapter) => adapter.kind === kind);
}

export function buildAgentResumeArgv(
  kind: AgentKind,
  sessionId: string,
): string[] | null {
  const adapter = getAgentAdapter(kind);
  if (!adapter) return null;
  return adapter.resumeArgs(sessionId);
}
