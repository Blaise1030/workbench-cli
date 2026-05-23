import { Hono } from "hono";
import { setCookie } from "hono/cookie";
import { zValidator } from "@hono/zod-validator";
import type { SessionToken } from "./token.js";
import { isTokenValid, isTokenExpired } from "./token.js";
import type { Session } from "./session.js";
import { activateSession } from "./session.js";
import { isInviteValid, consumeInvite } from "./invite.js";
import type { LanManager } from "../settings/lan.js";
import { authBodySchema } from "../../schemas/api.js";

export function createAuthRouter(
  token: SessionToken,
  session: Session,
  lan: LanManager,
) {
  return new Hono().post("/", zValidator("json", authBodySchema), async (c) => {
    const { token: inputToken } = c.req.valid("json");
    const input = inputToken ?? "";

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

    return c.json({ ok: true as const });
  });
}
