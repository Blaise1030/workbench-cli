export interface TerminalTab {
  id: string;
  worktreeId: string;
  title: string;
  sortOrder: number;
  resumeCommand: string | null;
  resumeTrusted: boolean;
  agentKind: string | null;
  agentSessionId: string | null;
  createdAt: string;
}
