import { Hono } from "hono";
import type { SessionToken } from "../modules/auth/token.js";
import type { Session } from "../modules/auth/session.js";
import type { LanManager } from "../modules/settings/lan.js";
import type { AppDatabase } from "../db/index.js";
import { createAuthRouter } from "../modules/auth/router.js";
import { createSettingsRouter } from "../modules/settings/router.js";
import { createWorkspaceRouter } from "../modules/workspace/router.js";

export function createApiRouter(
  token: SessionToken,
  session: Session,
  lan: LanManager,
  onLanToggle: (enabled: boolean) => Promise<void>,
  database: AppDatabase,
) {
  return new Hono()
    .route("/auth", createAuthRouter(token, session, lan))
    .route("/settings", createSettingsRouter(session, lan, onLanToggle))
    .route("/", createWorkspaceRouter(session, database));
}

export type ApiRouter = ReturnType<typeof createApiRouter>;
