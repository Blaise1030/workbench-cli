import { createServer } from "node:https";
import type { Server } from "node:http";
import { serve } from "@hono/node-server";
import { WebSocketServer, WebSocket } from "ws";
import * as pty from "node-pty";
import type { Hono } from "hono";
import { createToken } from "./token.js";
import { createSession, validateSession, deactivateSession } from "./session.js";
import type { Session } from "./session.js";
import { createApp } from "./app.js";
import { parseResize } from "./pty.js";
import { ensureTLS } from "./tls.js";
import type { TLSCredentials } from "./tls.js";
import { LanManager } from "./lan.js";
import { getLanIP } from "./network.js";

export { getLanIP } from "./network.js";

function parseSid(cookieHeader: string | undefined): string {
  if (!cookieHeader) return "";
  const match = cookieHeader.match(/(?:^|;\s*)sid=([^;]+)/);
  return match?.[1] ?? "";
}

interface ServerRuntime {
  httpServer: Server;
  wss: WebSocketServer;
  session: Session;
}

let runtime: ServerRuntime | null = null;

function attachWebSocketUpgrade(httpServer: Server, wss: WebSocketServer, session: Session): void {
  httpServer.on("upgrade", (req, socket, head) => {
    const url = new URL(req.url ?? "/", "https://localhost");
    if (url.pathname !== "/ws") {
      socket.destroy();
      return;
    }

    const sid = parseSid(req.headers.cookie);
    if (!validateSession(session, sid)) {
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
      socket.destroy();
      return;
    }

    wss.handleUpgrade(req, socket, head, (ws) => handlePTYConnection(ws, session));
  });
}

function handlePTYConnection(ws: WebSocket, session: Session): void {
  const shell = process.env.SHELL ?? "/bin/zsh";
  let ptyProcess: pty.IPty | null = null;

  ws.on("message", (msg: Buffer | string) => {
    const input = typeof msg === "string" ? msg : msg.toString("utf-8");
    const resize = parseResize(input);

    if (resize) {
      if (!ptyProcess) {
        const env: Record<string, string> = {};
        for (const [k, v] of Object.entries(process.env)) {
          if (v !== undefined) env[k] = v;
        }
        try {
          ptyProcess = pty.spawn(shell, ["-l"], {
            name: "xterm-256color",
            cols: resize.cols,
            rows: resize.rows,
            cwd: process.env.HOME ?? "/",
            env,
          });
        } catch (err) {
          console.error("PTY spawn failed:", err);
          if (ws.readyState === WebSocket.OPEN) ws.close();
          return;
        }
        ptyProcess.onData((data) => {
          if (ws.readyState === WebSocket.OPEN) ws.send(data);
        });
        ptyProcess.onExit(() => {
          if (ws.readyState === WebSocket.OPEN) ws.close();
        });
      } else {
        ptyProcess.resize(resize.cols, resize.rows);
      }
      return;
    }

    ptyProcess?.write(input);
  });

  ws.on("close", () => {
    ptyProcess?.kill();
    deactivateSession(session);
  });
}

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
): Promise<void> {
  await closeRuntime();

  const wss = new WebSocketServer({ noServer: true });

  const httpServer = serve({
    fetch: app.fetch,
    port,
    hostname,
    createServer: (opts: object, handler: (...args: unknown[]) => void) =>
      createServer({ ...opts, ...tls }, handler),
  } as Parameters<typeof serve>[0]) as Server;

  attachWebSocketUpgrade(httpServer, wss, session);
  runtime = { httpServer, wss, session };
}

export async function startServer(port = 3000): Promise<void> {
  const sessionToken = createToken();
  const session = createSession();
  const lan = new LanManager(port);

  async function onLanToggle(enabled: boolean): Promise<void> {
    if (enabled) {
      const ip = getLanIP();
      if (ip === "127.0.0.1") {
        throw new Error("No network interface found");
      }
      lan.enable(ip);
      const tls = await ensureTLS(...lan.getTlsHosts());
      const app = createApp(sessionToken, session, lan, onLanToggle);
      await listen(app, tls, port, lan.getHostname(), session);
    } else {
      lan.disable();
      const tls = await ensureTLS("localhost");
      const app = createApp(sessionToken, session, lan, onLanToggle);
      await listen(app, tls, port, lan.getHostname(), session);
    }
  }

  const tls = await ensureTLS("localhost");
  const app = createApp(sessionToken, session, lan, onLanToggle);
  await listen(app, tls, port, lan.getHostname(), session);

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
