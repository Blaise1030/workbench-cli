import { createServer as createHttpServer } from "node:http";
import { createServer as createHttpsServer } from "node:https";
import type { Server, IncomingMessage, ServerResponse } from "node:http";
import { getRequestListener } from "@hono/node-server";
import { WebSocketServer } from "ws";
import type { ViteDevServer } from "vite";
import type { Hono } from "hono";
import { createToken } from "./modules/auth/token.js";
import { createSession } from "./modules/auth/session.js";
import type { Session } from "./modules/auth/session.js";
import { createApp } from "./app.js";
import { LanManager } from "./modules/settings/lan.js";
import { resolveNetworkConfig } from "./modules/settings/network-config.js";
import { getLanIP } from "./modules/settings/network.js";
import { createDatabase } from "./db/index.js";
import type { AppDatabase } from "./db/index.js";
import { createSettingsStore } from "./modules/settings/store.js";
import type { SettingsStore } from "./modules/settings/store.js";
import { attachWebSocketUpgrade } from "./modules/terminal/handler.js";
import { createPtyRegistry } from "./modules/terminal/pty-registry.js";
import { handleAgentCommandComplete } from "./modules/agents/handle-command.js";
import type { PtyRegistry } from "./modules/terminal/pty-registry.js";
import {
  formatOrigin,
  resolveTransport,
  type ServerTransport,
} from "./transport.js";

export { getLanIP } from "./modules/settings/network.js";
export { LAN_REQUIRES_TLS_MESSAGE } from "./transport.js";

export interface StartServerOptions {
  forceHttp?: boolean;
  confirmMkcertInstall?: () => Promise<boolean>;
}

interface ServerRuntime {
  httpServer: Server;
  wss: WebSocketServer;
  session: Session;
  database: AppDatabase;
  settingsStore: SettingsStore;
  ptyRegistry: PtyRegistry;
  transport: ServerTransport;
}

let runtime: ServerRuntime | null = null;

async function closeRuntime(): Promise<void> {
  if (!runtime) return;
  const { httpServer, wss, ptyRegistry } = runtime;
  await ptyRegistry.shutdown();
  wss.clients.forEach((client) => client.close());
  await new Promise<void>((resolve) => httpServer.close(() => resolve()));
  runtime = null;
}

function registerShutdownHooks(): void {
  let shuttingDown = false;
  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`\n  ${signal} received, persisting scrollback…`);
    await closeRuntime();
    process.exit(0);
  };
  process.once("SIGTERM", () => void shutdown("SIGTERM"));
  process.once("SIGINT", () => void shutdown("SIGINT"));
}

async function listen(
  app: Hono,
  transport: ServerTransport,
  port: number,
  hostname: string,
  session: Session,
  database: AppDatabase,
  settingsStore: SettingsStore,
  ptyRegistry: PtyRegistry,
): Promise<void> {
  await closeRuntime();

  const wss = new WebSocketServer({ noServer: true });
  const honoHandler = getRequestListener(app.fetch);

  let viteMiddlewares: ViteDevServer["middlewares"] | null = null;

  const onRequest = (req: IncomingMessage, res: ServerResponse) => {
    const url = req.url ?? "/";
    if (viteMiddlewares && !url.startsWith("/api")) {
      viteMiddlewares(req, res, () => honoHandler(req, res));
    } else {
      honoHandler(req, res);
    }
  };

  const httpServer = transport.tls
    ? createHttpsServer(transport.tls, onRequest)
    : createHttpServer(onRequest);

  attachWebSocketUpgrade(httpServer, wss, session, database, ptyRegistry);

  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: { server: httpServer as any } },
      appType: "spa",
    });
    viteMiddlewares = vite.middlewares;
  }

  await new Promise<void>((resolve, reject) => {
    httpServer.once("error", reject);
    httpServer.listen(port, hostname, () => resolve());
  });

  runtime = {
    httpServer,
    wss,
    session,
    database,
    settingsStore,
    ptyRegistry,
    transport,
  };
}

export interface StartServerNetwork {
  port?: number;
  host?: string;
}

export async function startServer(
  networkOverrides: StartServerNetwork = {},
  options: StartServerOptions = {},
): Promise<void> {
  const network = resolveNetworkConfig(networkOverrides);
  const { port: listenPort, host: localHost } = network;
  const { forceHttp = false, confirmMkcertInstall } = options;
  const sessionToken = createToken();
  const session = createSession();
  const database = createDatabase();
  const settingsStore = createSettingsStore(database.db);
  let ptyRegistry = createPtyRegistry({
    settingsStore,
    onCommandComplete: async (terminalId, event) => {
      await handleAgentCommandComplete(
        database.db,
        settingsStore,
        terminalId,
        event,
        (kind, sessionId) => {
          ptyRegistry.setAgentSession(terminalId, kind, sessionId);
        },
      );
    },
  });
  const lan = new LanManager(listenPort, localHost);

  async function bindTransport(): Promise<ServerTransport> {
    return resolveTransport({
      hosts: lan.getTlsHosts(),
      requireTls: lan.mode === "lan",
      forceHttp: lan.mode === "localhost" && forceHttp,
      confirmMkcertInstall,
    });
  }

  async function restartWithTransport(transport: ServerTransport): Promise<void> {
    lan.setUrlScheme(transport.scheme);
    const cookieSecure = transport.scheme === "https";
    const app = createApp(
      sessionToken,
      session,
      lan,
      onLanToggle,
      database,
      settingsStore,
      ptyRegistry,
      cookieSecure,
    );
    await listen(
      app,
      transport,
      listenPort,
      lan.getHostname(),
      session,
      database,
      settingsStore,
      ptyRegistry,
    );
  }

  async function onLanToggle(enabled: boolean): Promise<void> {
    if (enabled) {
      const ip = getLanIP();
      if (ip === "127.0.0.1") {
        throw new Error("No network interface found");
      }
      const transport = await resolveTransport({
        hosts: [localHost, "localhost", ip],
        requireTls: true,
        confirmMkcertInstall,
      });
      lan.enable(ip);
      await restartWithTransport(transport);
      return;
    }

    lan.disable();
    await restartWithTransport(await bindTransport());
  }

  const transport = await bindTransport();
  await restartWithTransport(transport);
  registerShutdownHooks();

  console.log(`\n  Access token: ${sessionToken.value}`);
  console.log(`  Open: ${lan.getLocalUrl()}`);
  if (localHost !== "localhost" && localHost !== "127.0.0.1") {
    console.log(`  Add to /etc/hosts: 127.0.0.1 ${localHost}\n`);
  } else {
    console.log("");
  }
}

// Direct run (dev mode via tsx)
if (process.argv[1] && process.argv[1].endsWith("index.ts")) {
  startServer().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
