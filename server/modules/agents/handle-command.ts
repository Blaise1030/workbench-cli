import type { AppDatabase } from "../../db/index.js";
import type { SettingsStore } from "../settings/store.js";
import { isAgentHookEnabled } from "../settings/terminal-settings.js";
import { updateTerminalAgentSession } from "../workspace/terminals.js";
import { defaultAgentHome } from "./adapters.js";
import { matchAgentAdapter } from "./match.js";
import type { CommandCompleteEvent } from "./types.js";

export async function handleAgentCommandComplete(
  db: AppDatabase["db"],
  settingsStore: SettingsStore,
  terminalId: string,
  event: CommandCompleteEvent,
  onStored?: (kind: string, sessionId: string) => void,
): Promise<void> {
  const adapter = matchAgentAdapter(event.commandLine);
  if (!adapter) return;

  const enabled = await isAgentHookEnabled(settingsStore, adapter.kind);
  if (!enabled) return;

  const sessionId = adapter.findLatestSessionId(event.cwd, defaultAgentHome());
  if (!sessionId) return;

  await updateTerminalAgentSession(db, terminalId, adapter.kind, sessionId);
  onStored?.(adapter.kind, sessionId);
}
