import type { Server } from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import * as pty from "node-pty";
import type { Session } from "../auth/session.js";
import { validateSession, deactivateSession } from "../auth/session.js";
import { parseResize } from "./pty.js";

function parseSid(cookieHeader: string | undefined): string {
  if (!cookieHeader) return "";
  const match = cookieHeader.match(/(?:^|;\s*)sid=([^;]+)/);
  return match?.[1] ?? "";
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

export function attachWebSocketUpgrade(
  httpServer: Server,
  wss: WebSocketServer,
  session: Session,
): void {
  httpServer.on("upgrade", (req, socket, head) => {
    const url = new URL(req.url ?? "/", "https://localhost");
    if (url.pathname !== "/ws") return;

    const sid = parseSid(req.headers.cookie);
    if (!validateSession(session, sid)) {
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
      socket.destroy();
      return;
    }

    wss.handleUpgrade(req, socket, head, (ws) => handlePTYConnection(ws, session));
  });
}
