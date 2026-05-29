import { z } from "zod";

export const authBodySchema = z.object({
  token: z.string().optional(),
});

export const lanToggleBodySchema = z.object({
  enabled: z.boolean(),
});

export const authOkSchema = z.object({ ok: z.literal(true) });
export const errorBodySchema = z.object({ error: z.string() });

export const lanPublicStateSchema = z.object({
  enabled: z.boolean(),
  lanUrl: z.string().optional(),
  inviteExpiresAt: z.number().optional(),
});

export const networkSettingsSchema = z.object({
  /** Saved in ~/.workbench/config.json — applied on next restart. */
  host: z.string(),
  port: z.number().int(),
  /** Configured prod port (default branch worktrees). */
  prodPort: z.number().int(),
  /** Port for non-default-branch worktrees (prodPort + offset). */
  nonProdPort: z.number().int(),
  /** Currently running URL (may differ until restart). */
  localUrl: z.string(),
  scheme: z.enum(["http", "https"]),
  hostsFileLine: z.string(),
  pendingRestart: z.boolean(),
});

export const patchNetworkSettingsSchema = z.object({
  host: z.string().min(1).max(253).optional(),
  port: z.number().int().min(1).max(65535).optional(),
});

export const terminalSettingsSchema = z.object({
  autoResumeAgentSessions: z.boolean(),
  ptyIdleTtlHours: z.number().positive(),
  scrollbackCapKb: z.number().int().positive(),
  scrollbackPersistOnShutdown: z.boolean(),
  agentHooks: z.object({
    claude: z.boolean(),
    codex: z.boolean(),
    cursor: z.boolean(),
    gemini: z.boolean(),
  }),
});

export const patchTerminalSettingsSchema = terminalSettingsSchema.partial().extend({
  agentHooks: z
    .object({
      claude: z.boolean().optional(),
      codex: z.boolean().optional(),
      cursor: z.boolean().optional(),
      gemini: z.boolean().optional(),
    })
    .optional(),
});

export const approvedResumePrefixSchema = z.object({
  id: z.string(),
  prefix: z.string(),
  label: z.string().optional(),
  cwd: z.string().optional(),
  env: z.record(z.string()).optional(),
  approvedAt: z.number(),
});

export const createApprovedResumePrefixSchema = z.object({
  prefix: z.string().min(1),
  label: z.string().optional(),
  cwd: z.string().optional(),
  env: z.record(z.string()).optional(),
});

export type AuthBody = z.infer<typeof authBodySchema>;
export type LanToggleBody = z.infer<typeof lanToggleBodySchema>;
export type LanPublicState = z.infer<typeof lanPublicStateSchema>;
export type NetworkSettings = z.infer<typeof networkSettingsSchema>;
export type PatchNetworkSettings = z.infer<typeof patchNetworkSettingsSchema>;
export type TerminalSettings = z.infer<typeof terminalSettingsSchema>;
export type ApprovedResumePrefix = z.infer<typeof approvedResumePrefixSchema>;

// ── Keybindings ─────────────────────────────────────────────────────────────

export const KEYBINDING_ACTIONS = [
  "terminal.newTerminal",
  "panel.explorer",
  "panel.git",
  "contextQueue.invoke",
  "settings.open",
  "terminal.tab.1",
  "terminal.tab.2",
  "terminal.tab.3",
  "terminal.tab.4",
  "terminal.tab.5",
  "terminal.tab.6",
  "terminal.tab.7",
  "terminal.tab.8",
  "terminal.tab.9",
] as const;

export type KeybindingAction = (typeof KEYBINDING_ACTIONS)[number];

export type KeybindingsMap = Record<KeybindingAction, string>;

// Chord format: modifiers joined by "+", then "+key". Option = macOS ⌥ (Alt key).
// e.g. "Option+Shift+n", "Meta+n", "Ctrl+Shift+p"
const chordPattern = /^(Meta|Ctrl|Alt|Option|Shift)(\+(Meta|Ctrl|Alt|Option|Shift))*\+.+$/;

export const putKeybindingsSchema = z.object(
  Object.fromEntries(
    KEYBINDING_ACTIONS.map((a) => [a, z.string().regex(chordPattern)]),
  ) as Record<KeybindingAction, z.ZodString>,
);
