import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { networkInterfaces } from "os";
import { createToken } from "./token.js";
import { WebSocketServer, WebSocket } from "ws";
import * as pty from "node-pty";
import { validateToken } from "./token.js";
import { parseResize } from "./pty.js";

const isDev = process.env.NODE_ENV !== "production";
const PORT = parseInt(process.env.PORT ?? (isDev ? "3001" : "3000"), 10);

const sessionToken = createToken();

function getLanIP(): string {
  const nets = networkInterfaces();
  for (const ifaces of Object.values(nets)) {
    for (const iface of ifaces ?? []) {
      if (iface.family === "IPv4" && !iface.internal) return iface.address;
    }
  }
  return "localhost";
}

const app = new Hono();

if (!isDev) {
  app.use("/*", serveStatic({ root: "./dist" }));
}

const server = serve({ fetch: app.fetch, port: PORT, hostname: "0.0.0.0" });

const lanIP = getLanIP();
const openURL = `http://${lanIP}:${PORT}/?token=${sessionToken.value}`;
console.log(`\n  Access token: ${sessionToken.value}`);
console.log(`  Open: ${openURL}\n`);

const wss = new WebSocketServer({ noServer: true });

function handlePTYConnection(ws: WebSocket): void {
  const shell = process.env.SHELL ?? "/bin/zsh";
  let ptyProcess: pty.IPty | null = null;

  function cleanEnv(): Record<string, string> {
    const env: Record<string, string> = {};
    for (const [k, v] of Object.entries(process.env)) {
      if (v !== undefined) env[k] = v;
    }
    return env;
  }

  ws.on("message", (msg: Buffer | string) => {
    const input = typeof msg === "string" ? msg : msg.toString("utf-8");
    const resize = parseResize(input);

    if (resize) {
      if (!ptyProcess) {
        try {
          ptyProcess = pty.spawn(shell, ["-l"], {
            name: "xterm-256color",
            cols: resize.cols,
            rows: resize.rows,
            cwd: process.env.HOME ?? "/",
            env: cleanEnv(),
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
  });
}

(server as import("http").Server).on("upgrade", (req, socket, head) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  if (url.pathname !== "/ws") {
    socket.destroy();
    return;
  }

  const token = url.searchParams.get("token") ?? "";
  if (!validateToken(sessionToken, token)) {
    socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
    socket.destroy();
    return;
  }

  wss.handleUpgrade(req, socket, head, (ws) => handlePTYConnection(ws));
});
