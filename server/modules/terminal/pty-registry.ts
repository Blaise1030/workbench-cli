import type { WebSocket } from "ws";
import * as pty from "node-pty";
import { buildAgentResumeArgv } from "../agents/match.js";
import type { AgentKind } from "../agents/types.js";
import type { SettingsStore } from "../settings/store.js";
import {
  getTerminalSettings,
  isAgentHookEnabled,
  ptyIdleTtlMs,
  scrollbackCapBytes,
} from "../settings/terminal-settings.js";
import { RingBuffer } from "./ring-buffer.js";
import { parseResize } from "./pty.js";
import { shellIntegrationSpawn } from "./shell-integration.js";
import {
  deleteScrollback,
  dumpScrollback,
  loadScrollback,
} from "./scrollback-persist.js";
import { parseOscStream } from "./osc-parser.js";
import type { CommandCompleteEvent } from "../agents/types.js";

export interface TerminalAttachContext {
  cwd: string;
  resumeCommand?: string | null;
  resumeTrusted?: boolean;
  agentKind?: string | null;
  agentSessionId?: string | null;
}

interface PtyEntry {
  cwd: string;
  resumeCommand: string | null;
  resumeTrusted: boolean;
  agentKind: string | null;
  agentSessionId: string | null;
  pty: pty.IPty | null;
  ring: RingBuffer;
  clients: Set<WebSocket>;
  idleTimer: ReturnType<typeof setTimeout> | null;
  lastActivity: number;
  exitCode: number | null;
  pendingDiskScrollback: boolean;
  oscCarry: string;
}

export interface PtyRegistry {
  attach(terminalId: string, ws: WebSocket, ctx: TerminalAttachContext): Promise<void>;
  handleMessage(terminalId: string, ws: WebSocket, raw: string): Promise<void>;
  detach(terminalId: string, ws: WebSocket): void;
  kill(terminalId: string): void;
  has(terminalId: string): boolean;
  shutdown(): Promise<void>;
  setAgentSession(terminalId: string, agentKind: string, agentSessionId: string): void;
}

export interface PtyRegistryDeps {
  settingsStore: SettingsStore;
  onCommandComplete?: (terminalId: string, event: CommandCompleteEvent) => Promise<void>;
}

function broadcast(entry: PtyEntry, data: string | Buffer): void {
  const payload = typeof data === "string" ? data : data.toString("utf-8");
  for (const client of entry.clients) {
    if (client.readyState === client.OPEN) {
      client.send(payload);
    }
  }
}

function replayScrollback(ws: WebSocket, ring: RingBuffer): void {
  if (ws.readyState !== ws.OPEN) return;
  const snapshot = ring.snapshot();
  if (snapshot.length > 0) {
    ws.send(snapshot.toString("utf-8"));
  }
}

function processEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (v !== undefined) env[k] = v;
  }
  return env;
}

function applyAttachContext(entry: PtyEntry, ctx: TerminalAttachContext): void {
  entry.cwd = ctx.cwd;
  if (ctx.resumeCommand !== undefined) entry.resumeCommand = ctx.resumeCommand;
  if (ctx.resumeTrusted !== undefined) entry.resumeTrusted = ctx.resumeTrusted;
  if (ctx.agentKind !== undefined) entry.agentKind = ctx.agentKind;
  if (ctx.agentSessionId !== undefined) entry.agentSessionId = ctx.agentSessionId;
}

export function createPtyRegistry(deps: PtyRegistryDeps): PtyRegistry {
  const { settingsStore, onCommandComplete } = deps;
  const entries = new Map<string, PtyEntry>();

  async function getOrCreateEntry(
    terminalId: string,
    ctx: TerminalAttachContext,
  ): Promise<PtyEntry> {
    let entry = entries.get(terminalId);
    if (!entry) {
      const { scrollbackCapKb } = await getTerminalSettings(settingsStore);
      entry = {
        cwd: ctx.cwd,
        resumeCommand: ctx.resumeCommand ?? null,
        resumeTrusted: ctx.resumeTrusted ?? false,
        agentKind: ctx.agentKind ?? null,
        agentSessionId: ctx.agentSessionId ?? null,
        pty: null,
        ring: new RingBuffer(scrollbackCapBytes(scrollbackCapKb)),
        clients: new Set(),
        idleTimer: null,
        lastActivity: Date.now(),
        exitCode: null,
        pendingDiskScrollback: false,
        oscCarry: "",
      };
      entries.set(terminalId, entry);
    } else {
      applyAttachContext(entry, ctx);
    }
    return entry;
  }

  async function hydrateFromDisk(terminalId: string, entry: PtyEntry): Promise<void> {
    if (entry.pty || entry.ring.byteLength > 0) return;
    const { scrollbackPersistOnShutdown } = await getTerminalSettings(settingsStore);
    if (!scrollbackPersistOnShutdown) return;

    const loaded = loadScrollback(terminalId);
    if (!loaded) return;

    entry.ring.append(loaded.data);
    entry.cwd = loaded.meta.cwd || entry.cwd;
    entry.lastActivity = loaded.meta.lastActivity;
    entry.exitCode = loaded.meta.exitCode;
    entry.pendingDiskScrollback = true;
  }

  function clearIdleTimer(entry: PtyEntry): void {
    if (entry.idleTimer) {
      clearTimeout(entry.idleTimer);
      entry.idleTimer = null;
    }
  }

  async function scheduleIdleKill(terminalId: string, entry: PtyEntry): Promise<void> {
    if (entry.clients.size > 0) return;
    clearIdleTimer(entry);
    const { ptyIdleTtlHours } = await getTerminalSettings(settingsStore);
    const ttl = ptyIdleTtlMs(ptyIdleTtlHours);
    entry.idleTimer = setTimeout(() => {
      if (entry.clients.size === 0) {
        registry.kill(terminalId);
      }
    }, ttl);
  }

  function handleOscReports(terminalId: string, entry: PtyEntry, chunk: string): void {
    const parsed = parseOscStream(entry.oscCarry, chunk);
    entry.oscCarry = parsed.carry;
    for (const report of parsed.reports) {
      if (report.commandLine === undefined || report.commandExit === undefined) continue;
      void onCommandComplete?.(terminalId, {
        commandLine: report.commandLine,
        exitCode: report.commandExit,
        cwd: entry.cwd,
      });
    }
  }

  async function spawnPty(
    terminalId: string,
    entry: PtyEntry,
    cols: number,
    rows: number,
  ): Promise<void> {
    if (entry.pendingDiskScrollback) {
      deleteScrollback(terminalId);
      entry.pendingDiskScrollback = false;
    }

    const shell = process.env.SHELL ?? "/bin/zsh";
    const env = processEnv();
    const settings = await getTerminalSettings(settingsStore);
    const useCustomResume =
      Boolean(entry.resumeCommand?.trim()) && entry.resumeTrusted === true;

    let ptyProcess: pty.IPty;
    if (useCustomResume) {
      ptyProcess = pty.spawn(shell, ["-c", entry.resumeCommand!.trim()], {
        name: "xterm-256color",
        cols,
        rows,
        cwd: entry.cwd,
        env,
      });
    } else if (
      settings.autoResumeAgentSessions &&
      entry.agentKind &&
      entry.agentSessionId &&
      (await isAgentHookEnabled(settingsStore, entry.agentKind as AgentKind))
    ) {
      const argv = buildAgentResumeArgv(
        entry.agentKind as AgentKind,
        entry.agentSessionId,
      );
      if (argv && argv.length >= 2) {
        ptyProcess = pty.spawn(argv[0]!, argv.slice(1), {
          name: "xterm-256color",
          cols,
          rows,
          cwd: entry.cwd,
          env,
        });
      } else {
        const { env: shellEnv, args } = shellIntegrationSpawn(shell, env);
        ptyProcess = pty.spawn(shell, args, {
          name: "xterm-256color",
          cols,
          rows,
          cwd: entry.cwd,
          env: shellEnv,
        });
      }
    } else {
      const { env: shellEnv, args } = shellIntegrationSpawn(shell, env);
      ptyProcess = pty.spawn(shell, args, {
        name: "xterm-256color",
        cols,
        rows,
        cwd: entry.cwd,
        env: shellEnv,
      });
    }

    entry.pty = ptyProcess;
    entry.lastActivity = Date.now();
    entry.oscCarry = "";
    ptyProcess.onData((data) => {
      entry.lastActivity = Date.now();
      handleOscReports(terminalId, entry, data);
      entry.ring.append(data);
      broadcast(entry, data);
    });
    ptyProcess.onExit(({ exitCode }) => {
      entry.pty = null;
      entry.exitCode = exitCode;
      if (entry.clients.size === 0) {
        void scheduleIdleKill(terminalId, entry);
      } else {
        for (const client of entry.clients) {
          if (client.readyState === client.OPEN) client.close();
        }
      }
    });
  }

  const registry: PtyRegistry = {
    async attach(terminalId, ws, ctx) {
      const entry = await getOrCreateEntry(terminalId, ctx);
      await hydrateFromDisk(terminalId, entry);
      clearIdleTimer(entry);
      entry.clients.add(ws);
      replayScrollback(ws, entry.ring);
    },

    async handleMessage(terminalId, ws, raw) {
      const entry = entries.get(terminalId);
      if (!entry || !entry.clients.has(ws)) return;

      const resize = parseResize(raw);
      if (resize) {
        if (!entry.pty) {
          try {
            await spawnPty(terminalId, entry, resize.cols, resize.rows);
          } catch (err) {
            console.error("PTY spawn failed:", err);
            if (ws.readyState === ws.OPEN) ws.close();
          }
        } else {
          entry.pty.resize(resize.cols, resize.rows);
        }
        return;
      }

      entry.pty?.write(raw);
    },

    detach(terminalId, ws) {
      const entry = entries.get(terminalId);
      if (!entry) return;
      entry.clients.delete(ws);
      if (entry.clients.size === 0) {
        void scheduleIdleKill(terminalId, entry);
      }
    },

    kill(terminalId) {
      const entry = entries.get(terminalId);
      if (!entry) {
        deleteScrollback(terminalId);
        return;
      }
      clearIdleTimer(entry);
      entry.pty?.kill();
      entry.pty = null;
      for (const client of entry.clients) {
        if (client.readyState === client.OPEN) client.close();
      }
      entry.clients.clear();
      entries.delete(terminalId);
      deleteScrollback(terminalId);
    },

    has(terminalId) {
      return entries.has(terminalId);
    },

    setAgentSession(terminalId, agentKind, agentSessionId) {
      const entry = entries.get(terminalId);
      if (!entry) return;
      entry.agentKind = agentKind;
      entry.agentSessionId = agentSessionId;
    },

    async shutdown() {
      const { scrollbackPersistOnShutdown } = await getTerminalSettings(settingsStore);
      if (!scrollbackPersistOnShutdown) return;

      for (const [terminalId, entry] of entries) {
        const snapshot = entry.ring.snapshot();
        if (snapshot.length === 0) continue;
        dumpScrollback(terminalId, snapshot, {
          cwd: entry.cwd,
          lastActivity: entry.lastActivity,
          exitCode: entry.exitCode,
        });
      }
    },
  };

  return registry;
}
