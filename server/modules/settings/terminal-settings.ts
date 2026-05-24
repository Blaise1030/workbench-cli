import { randomUUID } from "node:crypto";
import type { SettingsStore } from "./store.js";

import type { AgentKind } from "../agents/types.js";

export const TERMINAL_SETTINGS_KEYS = {
  autoResumeAgentSessions: "terminal.autoResumeAgentSessions",
  ptyIdleTtlHours: "terminal.ptyIdleTtlHours",
  scrollbackCapKb: "terminal.scrollbackCapKb",
  scrollbackPersistOnShutdown: "terminal.scrollbackPersistOnShutdown",
  resumeCommandsApprovedPrefixes: "terminal.resumeCommands.approvedPrefixes",
} as const;

export const SUPPORTED_AGENT_KINDS = ["claude", "codex"] as const satisfies readonly AgentKind[];

export function agentHookSettingsKey(kind: AgentKind): string {
  return `terminal.agentHooks.${kind}.enabled`;
}

export const TERMINAL_SETTINGS_DEFAULTS = {
  autoResumeAgentSessions: true,
  ptyIdleTtlHours: 24,
  scrollbackCapKb: 4096,
  scrollbackPersistOnShutdown: true,
} as const;

export interface ApprovedResumePrefix {
  id: string;
  prefix: string;
  label?: string;
  cwd?: string;
  env?: Record<string, string>;
  approvedAt: number;
}

export interface TerminalSettings {
  autoResumeAgentSessions: boolean;
  ptyIdleTtlHours: number;
  scrollbackCapKb: number;
  scrollbackPersistOnShutdown: boolean;
  agentHooks: Record<AgentKind, boolean>;
}

export async function getTerminalSettings(store: SettingsStore): Promise<TerminalSettings> {
  const [autoResumeAgentSessions, ptyIdleTtlHours, scrollbackCapKb, scrollbackPersistOnShutdown] =
    await Promise.all([
      store.get(TERMINAL_SETTINGS_KEYS.autoResumeAgentSessions, TERMINAL_SETTINGS_DEFAULTS.autoResumeAgentSessions),
      store.get(TERMINAL_SETTINGS_KEYS.ptyIdleTtlHours, TERMINAL_SETTINGS_DEFAULTS.ptyIdleTtlHours),
      store.get(TERMINAL_SETTINGS_KEYS.scrollbackCapKb, TERMINAL_SETTINGS_DEFAULTS.scrollbackCapKb),
      store.get(
        TERMINAL_SETTINGS_KEYS.scrollbackPersistOnShutdown,
        TERMINAL_SETTINGS_DEFAULTS.scrollbackPersistOnShutdown,
      ),
    ]);
  const agentHooks = {} as Record<AgentKind, boolean>;
  for (const kind of SUPPORTED_AGENT_KINDS) {
    agentHooks[kind] = await store.get(agentHookSettingsKey(kind), true);
  }
  return { autoResumeAgentSessions, ptyIdleTtlHours, scrollbackCapKb, scrollbackPersistOnShutdown, agentHooks };
}

export async function isAgentHookEnabled(store: SettingsStore, kind: AgentKind): Promise<boolean> {
  return store.get(agentHookSettingsKey(kind), true);
}

export type PatchTerminalSettings = Omit<Partial<TerminalSettings>, "agentHooks"> & {
  agentHooks?: Partial<Record<AgentKind, boolean>>;
};

export async function patchTerminalSettings(
  store: SettingsStore,
  patch: PatchTerminalSettings,
): Promise<TerminalSettings> {
  const current = await getTerminalSettings(store);
  const next = {
    ...current,
    ...patch,
    agentHooks: { ...current.agentHooks, ...patch.agentHooks },
  };
  await Promise.all([
    store.set(TERMINAL_SETTINGS_KEYS.autoResumeAgentSessions, next.autoResumeAgentSessions),
    store.set(TERMINAL_SETTINGS_KEYS.ptyIdleTtlHours, next.ptyIdleTtlHours),
    store.set(TERMINAL_SETTINGS_KEYS.scrollbackCapKb, next.scrollbackCapKb),
    store.set(TERMINAL_SETTINGS_KEYS.scrollbackPersistOnShutdown, next.scrollbackPersistOnShutdown),
    ...SUPPORTED_AGENT_KINDS.map((kind) =>
      store.set(agentHookSettingsKey(kind), next.agentHooks[kind]),
    ),
  ]);
  return next;
}

export async function listApprovedResumePrefixes(store: SettingsStore): Promise<ApprovedResumePrefix[]> {
  return store.get(TERMINAL_SETTINGS_KEYS.resumeCommandsApprovedPrefixes, [] as ApprovedResumePrefix[]);
}

export async function addApprovedResumePrefix(
  store: SettingsStore,
  input: { prefix: string; label?: string; cwd?: string; env?: Record<string, string> },
): Promise<ApprovedResumePrefix> {
  const list = await listApprovedResumePrefixes(store);
  const entry: ApprovedResumePrefix = {
    id: randomUUID(),
    prefix: input.prefix.trim(),
    label: input.label?.trim() || undefined,
    cwd: input.cwd?.trim() || undefined,
    env: input.env,
    approvedAt: Date.now(),
  };
  await store.set(TERMINAL_SETTINGS_KEYS.resumeCommandsApprovedPrefixes, [...list, entry]);
  return entry;
}

export async function revokeApprovedResumePrefix(
  store: SettingsStore,
  id: string,
): Promise<boolean> {
  const list = await listApprovedResumePrefixes(store);
  const next = list.filter((item) => item.id !== id);
  if (next.length === list.length) return false;
  await store.set(TERMINAL_SETTINGS_KEYS.resumeCommandsApprovedPrefixes, next);
  return true;
}

export function scrollbackCapBytes(scrollbackCapKb: number): number {
  return Math.max(64, scrollbackCapKb) * 1024;
}

export function ptyIdleTtlMs(ptyIdleTtlHours: number): number {
  return Math.max(1, ptyIdleTtlHours) * 60 * 60 * 1000;
}
