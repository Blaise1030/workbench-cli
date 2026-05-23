import { createServer } from "node:https";
import type { Server, IncomingMessage, ServerResponse } from "node:http";
import { getRequestListener } from "@hono/node-server";
import { WebSocketServer } from "ws";
import type { ViteDevServer } from "vite";
import type { Hono } from "hono";
import { createToken } from "./modules/auth/token.js";
import { createSession } from "./modules/auth/session.js";
import type { Session } from "./modules/auth/session.js";
import { createApp } from "./app.js";
import { ensureTLS } from "./tls.js";
import type { TLSCredentials } from "./tls.js";
import { LanManager } from "./modules/settings/lan.js";
import { getLanIP } from "./modules/settings/network.js";
import { createDatabase } from "./db/index.js";
import type { AppDatabase } from "./db/index.js";
import { attachWebSocketUpgrade } from "./modules/terminal/handler.js";

export { getLanIP } from "./modules/settings/network.js";

interface ServerRuntime {
  httpServer: Server;
  wss: WebSocketServer;
  session: Session;
  database: AppDatabase;
}

let runtime: ServerRuntime | null = null;

async function closeRuntime(): Promise<void> {
  if (!runtime) return;
  const { httpServer, wss } = runtime;
  wss.clients.forEach((client) => client.close());
  await new Promise<void>((resolve) => httpServer.close(() => resolve()));
  runtime = null;
}

async function listen(
  app: Hono,
  tls: TLSCredentials,
  port: number,
  hostname: string,
  session: Session,
  database: AppDatabase,
): Promise<void> {
  await closeRuntime();

  const wss = new WebSocketServer({ noServer: true });
  const honoHandler = getRequestListener(app.fetch);

  let viteMiddlewares: ViteDevServer["middlewares"] | null = null;

  const httpServer = createServer(
    tls,
    (req: IncomingMessage, res: ServerResponse) => {
      const url = req.url ?? "/";
      if (viteMiddlewares && !url.startsWith("/api")) {
        viteMiddlewares(req, res, () => honoHandler(req, res));
      } else {
        honoHandler(req, res);
      }
    },
  ) as unknown as Server;

  // Register PTY upgrade handler BEFORE Vite attaches its HMR listener,
  // so our /ws handler runs first and non-/ws paths fall through to Vite.
  attachWebSocketUpgrade(httpServer, wss, session, database);

  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: { server: httpServer as any } },
      appType: "spa",
    });
    viteMiddlewares = vite.middlewares;
  }

  (httpServer as any).listen(port, hostname);
  runtime = { httpServer, wss, session, database };
}

export async function startServer(port = 3000): Promise<void> {
  const sessionToken = createToken();
  const session = createSession();
  const database = createDatabase();
  const lan = new LanManager(port);

  async function onLanToggle(enabled: boolean): Promise<void> {
    if (enabled) {
      const ip = getLanIP();
      if (ip === "127.0.0.1") {
        throw new Error("No network interface found");
      }
      lan.enable(ip);
      const tls = await ensureTLS(...lan.getTlsHosts());
      const app = createApp(sessionToken, session, lan, onLanToggle, database);
      await listen(app, tls, port, lan.getHostname(), session, database);
    } else {
      lan.disable();
      const tls = await ensureTLS("localhost");
      const app = createApp(sessionToken, session, lan, onLanToggle, database);
      await listen(app, tls, port, lan.getHostname(), session, database);
    }
  }

  const tls = await ensureTLS("localhost");
  const app = createApp(sessionToken, session, lan, onLanToggle, database);
  await listen(app, tls, port, lan.getHostname(), session, database);

  console.log(`\n  Access token: ${sessionToken.value}`);
  console.log(`  Open: https://localhost:${port}/\n`);
}

// Direct run (dev mode via tsx)
if (process.argv[1] && process.argv[1].endsWith("index.ts")) {
  const port = parseInt(process.env.PORT ?? "3001", 10);
  startServer(port).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
