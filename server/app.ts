import { Hono } from "hono";
import { serveStatic } from "@hono/node-server/serve-static";
import type { SessionToken } from "./modules/auth/token.js";
import type { Session } from "./modules/auth/session.js";
import type { LanManager } from "./modules/settings/lan.js";
import type { AppDatabase } from "./db/index.js";
import type { SettingsStore } from "./modules/settings/store.js";
import type { PtyRegistry } from "./modules/terminal/pty-registry.js";
import { createApiRouter } from "./api/index.js";

export function createApp(
  token: SessionToken,
  session: Session,
  lan: LanManager,
  onLanToggle: (enabled: boolean) => Promise<void>,
  database: AppDatabase,
  settingsStore: SettingsStore,
  ptyRegistry: PtyRegistry,
): Hono {
  const app = new Hono();

  app.route(
    "/api",
    createApiRouter(token, session, lan, onLanToggle, database, settingsStore, ptyRegistry),
  );

  app.use("/*", serveStatic({ root: "./dist/public" }));

  return app;
}
