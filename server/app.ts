import { Hono } from "hono";
import { serveStatic } from "@hono/node-server/serve-static";
import type { SessionToken } from "./modules/auth/token.js";
import type { Session } from "./modules/auth/session.js";
import type { LanManager } from "./modules/settings/lan.js";
import { createApiRouter } from "./api/index.js";

export function createApp(
  token: SessionToken,
  session: Session,
  lan: LanManager,
  onLanToggle: (enabled: boolean) => Promise<void>,
): Hono {
  const app = new Hono();

  app.route("/api", createApiRouter(token, session, lan, onLanToggle));

  app.use("/*", serveStatic({ root: "./dist/public" }));

  return app;
}
