export type AgentKind = "claude" | "codex" | "cursor" | "gemini";

export interface AgentAdapter {
  kind: AgentKind;
  binaries: string[];
  resumeArgs(sessionId: string): string[];
  findLatestSessionId(cwd: string, home: string): string | null;
}

export interface CommandCompleteEvent {
  commandLine: string;
  exitCode: number;
  cwd: string;
}
