import { Hono } from "hono";
import { setCookie } from "hono/cookie";
import { serveStatic } from "@hono/node-server/serve-static";
import { SessionToken, isTokenValid, isTokenExpired } from "./token.js";
import { Session, activateSession } from "./session.js";

export function createApp(token: SessionToken, session: Session): Hono {
  const app = new Hono();

  app.post("/auth", async (c) => {
    const body = await c.req.json<{ token?: string }>();
    const input = body?.token ?? "";

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

  app.use("/*", serveStatic({ root: "./dist/public" }));

  return app;
}
