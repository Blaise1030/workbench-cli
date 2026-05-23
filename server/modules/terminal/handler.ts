import type { Server } from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import * as pty from "node-pty";
import type { Session } from "../auth/session.js";
import { validateSession, activateSession } from "../auth/session.js";
import { isLoopbackAddress } from "../auth/local.js";
import type { AppDatabase } from "../../db/index.js";
import { getTerminalWithWorktree, TerminalError } from "../workspace/terminals.js";
import { parseResize } from "./pty.js";
import { shellIntegrationSpawn } from "./shell-integration.js";

function parseSid(cookieHeader: string | undefined): string {
  if (!cookieHeader) return "";
  const match = cookieHeader.match(/(?:^|;\s*)sid=([^;]+)/);
  return match?.[1] ?? "";
}

function parseTerminalId(url: URL): string {
  return url.searchParams.get("terminalId")?.trim() ?? "";
}

function handlePTYConnection(ws: WebSocket, cwd: string): void {
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
          const { env: shellEnv, args } = shellIntegrationSpawn(shell, env);
          ptyProcess = pty.spawn(shell, args, {
            name: "xterm-256color",
            cols: resize.cols,
            rows: resize.rows,
            cwd,
            env: shellEnv,
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

export function attachWebSocketUpgrade(
  httpServer: Server,
  wss: WebSocketServer,
  session: Session,
  database: AppDatabase,
): void {
  httpServer.on("upgrade", async (req, socket, head) => {
    const url = new URL(req.url ?? "/", "https://localhost");
    if (url.pathname !== "/ws") return;

    const sid = parseSid(req.headers.cookie);
    const peer = req.socket.remoteAddress;
    if (!validateSession(session, sid)) {
      if (!isLoopbackAddress(peer)) {
        socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
        socket.destroy();
        return;
      }
      activateSession(session);
    }

    const terminalId = parseTerminalId(url);
    if (!terminalId) {
      socket.write("HTTP/1.1 400 Bad Request\r\n\r\n");
      socket.destroy();
      return;
    }

    try {
      const record = await getTerminalWithWorktree(database.db, terminalId);
      if (!record) {
        socket.write("HTTP/1.1 404 Not Found\r\n\r\n");
        socket.destroy();
        return;
      }

      wss.handleUpgrade(req, socket, head, (ws) => {
        handlePTYConnection(ws, record.worktree.path);
      });
    } catch (err) {
      if (err instanceof TerminalError) {
        socket.write(`HTTP/1.1 ${err.status} ${err.status === 404 ? "Not Found" : "Bad Request"}\r\n\r\n`);
        socket.destroy();
        return;
      }
      socket.write("HTTP/1.1 500 Internal Server Error\r\n\r\n");
      socket.destroy();
    }
  });
}
