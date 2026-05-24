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
export type TerminalSettings = z.infer<typeof terminalSettingsSchema>;
export type ApprovedResumePrefix = z.infer<typeof approvedResumePrefixSchema>;
