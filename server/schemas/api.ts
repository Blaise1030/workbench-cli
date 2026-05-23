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

export type AuthBody = z.infer<typeof authBodySchema>;
export type LanToggleBody = z.infer<typeof lanToggleBodySchema>;
export type LanPublicState = z.infer<typeof lanPublicStateSchema>;
