import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { requireSession } from "../auth/middleware.js";
import type { Session } from "../auth/session.js";
import type { LanManager } from "./lan.js";
import { getLanIP } from "./network.js";
import {
  createApprovedResumePrefixSchema,
  lanToggleBodySchema,
  patchTerminalSettingsSchema,
} from "../../schemas/api.js";
import type { SettingsStore } from "./store.js";
import {
  addApprovedResumePrefix,
  getTerminalSettings,
  listApprovedResumePrefixes,
  patchTerminalSettings,
  revokeApprovedResumePrefix,
  type PatchTerminalSettings,
} from "./terminal-settings.js";

export function createSettingsRouter(
  session: Session,
  lan: LanManager,
  onLanToggle: (enabled: boolean) => Promise<void>,
  settingsStore: SettingsStore,
) {
  return new Hono()
    .use("*", requireSession(session))
    .get("/lan", (c) => c.json(lan.getPublicState()))
    .post("/lan", zValidator("json", lanToggleBodySchema), async (c) => {
      const { enabled } = c.req.valid("json");

      if (enabled) {
        const ip = getLanIP();
        if (ip === "127.0.0.1") {
          return c.json({ error: "No network interface found" }, 503);
        }
      }

      try {
        await onLanToggle(enabled);
      } catch {
        return c.json({ error: "Failed to change network mode" }, 500);
      }

      return c.json(lan.getPublicState());
    })
    .post("/lan/refresh-invite", (c) => {
      if (lan.mode !== "lan") {
        return c.json({ error: "LAN is not enabled" }, 400);
      }
      lan.refreshInvite();
      return c.json(lan.getPublicState());
    })
    .get("/terminal", async (c) => {
      const settings = await getTerminalSettings(settingsStore);
      return c.json(settings);
    })
    .patch("/terminal", zValidator("json", patchTerminalSettingsSchema), async (c) => {
      const patch = c.req.valid("json") as PatchTerminalSettings;
      const settings = await patchTerminalSettings(settingsStore, patch);
      return c.json(settings);
    })
    .get("/terminal/resume-commands", async (c) => {
      const approvedPrefixes = await listApprovedResumePrefixes(settingsStore);
      return c.json({ approvedPrefixes });
    })
    .post(
      "/terminal/resume-commands",
      zValidator("json", createApprovedResumePrefixSchema),
      async (c) => {
        const body = c.req.valid("json");
        const entry = await addApprovedResumePrefix(settingsStore, body);
        return c.json({ prefix: entry }, 201);
      },
    )
    .delete("/terminal/resume-commands/:id", async (c) => {
      const ok = await revokeApprovedResumePrefix(settingsStore, c.req.param("id"));
      if (!ok) return c.json({ error: "Not found" }, 404);
      return c.json({ ok: true as const });
    });
}
