export interface AgentHookEvent {
  id: string;
  label: string;
  description: string;
}

export interface AgentHooksConfig {
  enabled: boolean;
  events: Record<string, boolean>;
  title: string;
  body: string;
}

export interface WorkbenchAgent {
  id: string;
  name: string;
  icon?: string;
  startCommand: string;
  resumeCommand: string;
  matchBinaries?: string[];
  configPath?: string;
  canApplyHooks?: boolean;
  builtin?: boolean;
  hooks: AgentHooksConfig;
}

export interface AgentResponseMeta {
  id: string;
  supportedEvents: AgentHookEvent[];
}

export interface AgentManifest {
  enabled: boolean;
  notifyCommand?: string;
  settingsMerge?: string;
  installHint?: string;
}

export interface AgentsResponse {
  agents: WorkbenchAgent[];
  meta: Record<string, AgentResponseMeta>;
  manifests: Record<string, AgentManifest>;
  port: number;
}

export interface ApplyAgentHooksResult {
  ok: boolean;
  configPath: string;
  backupPath: string;
}

export interface PatchAgentHooks {
  enabled?: boolean;
  events?: Record<string, boolean>;
  title?: string;
  body?: string;
}

export interface PatchWorkbenchAgent {
  name?: string;
  startCommand?: string;
  resumeCommand?: string;
  matchBinaries?: string[];
  hooks?: PatchAgentHooks;
}
