import { createServer } from "node:https";
import { serve } from "@hono/node-server";
import { networkInterfaces } from "node:os";
import { WebSocketServer, WebSocket } from "ws";
import * as pty from "node-pty";
import { createToken } from "./token.js";
import { createSession, validateSession, deactivateSession } from "./session.js";
import { createApp } from "./app.js";
import { parseResize } from "./pty.js";
import type { TLSCredentials } from "./tls.js";

export function getLanIP(): string {
  const nets = networkInterfaces();
  for (const ifaces of Object.values(nets)) {
    for (const iface of ifaces ?? []) {
      if (iface.family === "IPv4" && !iface.internal) return iface.address;
    }
  }
  return "127.0.0.1";
}

function parseSid(cookieHeader: string | undefined): string {
  if (!cookieHeader) return "";
  const match = cookieHeader.match(/(?:^|;\s*)sid=([^;]+)/);
  return match?.[1] ?? "";
}

export function startServer(tls: TLSCredentials, port = 3000): void {
  const sessionToken = createToken();
  const session = createSession();
  const app = createApp(sessionToken, session);

  const server = serve({
    fetch: app.fetch,
    port,
    hostname: "0.0.0.0",
    createServer: (opts: object, handler: (...args: unknown[]) => void) =>
      createServer({ ...opts, ...tls }, handler),
  } as Parameters<typeof serve>[0]);

  const lanIP = getLanIP();
  console.log(`\n  Access token: ${sessionToken.value}`);
  console.log(`  Open: https://${lanIP}:${port}/\n`);

  const wss = new WebSocketServer({ noServer: true });

  function handlePTYConnection(ws: WebSocket): void {
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

  (server as import("http").Server).on("upgrade", (req, socket, head) => {
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

    wss.handleUpgrade(req, socket, head, (ws) => handlePTYConnection(ws));
  });
}

// Direct run (dev mode via tsx)
if (process.argv[1] && process.argv[1].endsWith("index.ts")) {
  import("./tls.js").then(({ ensureTLS }) => {
    const port = parseInt(process.env.PORT ?? "3001", 10);
    ensureTLS(getLanIP()).then((tls) => startServer(tls, port));
  });
}
