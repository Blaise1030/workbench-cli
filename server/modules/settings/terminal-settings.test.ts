import { describe, it, expect } from "vitest";
import { createDatabase } from "../../db/index.js";
import { createSettingsStore } from "./store.js";
import {
  addApprovedResumePrefix,
  getTerminalSettings,
  listApprovedResumePrefixes,
  patchTerminalSettings,
  revokeApprovedResumePrefix,
  TERMINAL_SETTINGS_DEFAULTS,
} from "./terminal-settings.js";

describe("terminal settings", () => {
  const database = createDatabase(":memory:");
  const store = createSettingsStore(database.db);

  it("returns defaults", async () => {
    const settings = await getTerminalSettings(store);
    expect(settings.autoResumeAgentSessions).toBe(TERMINAL_SETTINGS_DEFAULTS.autoResumeAgentSessions);
    expect(settings.ptyIdleTtlHours).toBe(TERMINAL_SETTINGS_DEFAULTS.ptyIdleTtlHours);
    expect(settings.agentHooks).toEqual({
      claude: true,
      codex: true,
      cursor: true,
      gemini: true,
    });
  });

  it("patches partial settings", async () => {
    const next = await patchTerminalSettings(store, { ptyIdleTtlHours: 12 });
    expect(next.ptyIdleTtlHours).toBe(12);
    expect(next.scrollbackCapKb).toBe(TERMINAL_SETTINGS_DEFAULTS.scrollbackCapKb);
  });

  it("manages approved resume prefixes", async () => {
    const entry = await addApprovedResumePrefix(store, {
      prefix: "tmux attach",
      label: "work",
    });
    const list = await listApprovedResumePrefixes(store);
    expect(list).toHaveLength(1);
    expect(list[0]?.id).toBe(entry.id);
    const revoked = await revokeApprovedResumePrefix(store, entry.id);
    expect(revoked).toBe(true);
    expect(await listApprovedResumePrefixes(store)).toHaveLength(0);
  });
});
