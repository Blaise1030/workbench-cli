import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { requireSession } from "../auth/middleware.js";
import type { Session } from "../auth/session.js";
import type { LanManager } from "./lan.js";
import { getLanIP } from "./network.js";
import { lanToggleBodySchema } from "../../schemas/api.js";

export function createSettingsRouter(
  session: Session,
  lan: LanManager,
  onLanToggle: (enabled: boolean) => Promise<void>,
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
    });
}
