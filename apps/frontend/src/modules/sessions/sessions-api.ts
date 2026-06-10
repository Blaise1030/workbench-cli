export interface AgentSession {
  id: string;
  worktreeId: string;
  title: string;
  agentKind: string | null;
  agentSessionId: string | null;
  agentStatus: string;
  isAlive: boolean;
  createdAt: string;
}

export async function fetchSessions(): Promise<AgentSession[]> {
  const res = await fetch("/api/sessions", { credentials: "include" });
  if (!res.ok) throw new Error(`Sessions fetch failed (${res.status})`);
  const data = (await res.json()) as { sessions: AgentSession[] };
  return data.sessions;
}

export async function ackSession(terminalId: string): Promise<void> {
  const res = await fetch(
    `/api/sessions/${encodeURIComponent(terminalId)}/ack`,
    { method: "POST", credentials: "include" },
  );
  if (!res.ok) throw new Error(`Session ack failed (${res.status})`);
}
