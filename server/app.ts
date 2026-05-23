import { Hono } from "hono";
import { setCookie } from "hono/cookie";
import { serveStatic } from "@hono/node-server/serve-static";
import { SessionToken, isTokenValid, isTokenExpired } from "./token.js";
import { Session, activateSession } from "./session.js";
import { isInviteValid, consumeInvite } from "./invite.js";
import { requireSession } from "./middleware.js";
import type { LanManager } from "./lan.js";
import { getLanIP } from "./network.js";

export function createApp(
  token: SessionToken,
  session: Session,
  lan: LanManager,
  onLanToggle: (enabled: boolean) => Promise<void>,
): Hono {
  const app = new Hono();

  app.post("/auth", async (c) => {
    const body = await c.req.json<{ token?: string }>();
    const input = body?.token ?? "";

    const invite = lan.getInvite();
    if (isInviteValid(invite, input)) {
      if (session.active) {
        return c.json({ error: "Another session is already active" }, 409);
      }
      consumeInvite(invite!);
      activateSession(session);
      setCookie(c, "sid", session.sid, {
        httpOnly: true,
        secure: true,
        sameSite: "Strict",
        maxAge: 3600,
        path: "/",
      });
      return c.json({ ok: true });
    }

    if (invite && input === invite.value) {
      if (invite.used) {
        return c.json({ error: "Invite link already used" }, 401);
      }
      if (Date.now() >= invite.expiresAt) {
        return c.json({ error: "Invite link expired — ask host to regenerate" }, 401);
      }
    }

    if (!isTokenValid(token, input)) {
      if (isTokenExpired(token)) {
        return c.json({ error: "Token expired — restart the server" }, 401);
      }
      return c.json({ error: "Invalid token" }, 401);
    }

    if (session.active) {
      return c.json({ error: "Another session is already active" }, 409);
    }

    activateSession(session);

    setCookie(c, "sid", session.sid, {
      httpOnly: true,
      secure: true,
      sameSite: "Strict",
      maxAge: 3600,
      path: "/",
    });

    return c.json({ ok: true });
  });

  const settings = new Hono();
  settings.use("*", requireSession(session));

  settings.get("/lan", (c) => {
    return c.json(lan.getPublicState());
  });

  settings.post("/lan", async (c) => {
    const body = await c.req.json<{ enabled?: boolean }>();
    const enabled = body?.enabled;
    if (typeof enabled !== "boolean") {
      return c.json({ error: "enabled must be a boolean" }, 400);
    }

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
  });

  settings.post("/lan/refresh-invite", (c) => {
    if (lan.mode !== "lan") {
      return c.json({ error: "LAN is not enabled" }, 400);
    }
    lan.refreshInvite();
    return c.json(lan.getPublicState());
  });

  app.route("/api/settings", settings);

  app.use("/*", serveStatic({ root: "./dist/public" }));

  return app;
}
