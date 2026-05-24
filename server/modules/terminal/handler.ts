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

const MAX_SCROLLBACK = 200_000;

interface PtyEntry {
  process: pty.IPty;
  scrollback: string;
  currentWs: WebSocket | null;
}

const ptyRegistry = new Map<string, PtyEntry>();

export function killPtySession(terminalId: string): void {
  const entry = ptyRegistry.get(terminalId);
  if (!entry) return;
  entry.currentWs?.close();
  entry.process.kill();
  ptyRegistry.delete(terminalId);
}

function parseSid(cookieHeader: string | undefined): string {
  if (!cookieHeader) return "";
  const match = cookieHeader.match(/(?:^|;\s*)sid=([^;]+)/);
  return match?.[1] ?? "";
}

function parseTerminalId(url: URL): string {
  return url.searchParams.get("terminalId")?.trim() ?? "";
}

function handlePTYConnection(ws: WebSocket, cwd: string, terminalId: string): void {
  const shell = process.env.SHELL ?? "/bin/zsh";
  const existing = ptyRegistry.get(terminalId);

  if (existing) {
    existing.currentWs = ws;
    if (existing.scrollback && ws.readyState === WebSocket.OPEN) {
      ws.send(existing.scrollback);
    }
  }

  ws.on("message", (msg: Buffer | string) => {
    const input = typeof msg === "string" ? msg : msg.toString("utf-8");
    const resize = parseResize(input);

    if (resize) {
      const entry = ptyRegistry.get(terminalId);
      if (!entry) {
        const env: Record<string, string> = {};
        for (const [k, v] of Object.entries(process.env)) {
          if (v !== undefined) env[k] = v;
        }
        try {
          const { env: shellEnv, args } = shellIntegrationSpawn(shell, env);
          const ptyProcess = pty.spawn(shell, args, {
            name: "xterm-256color",
            cols: resize.cols,
            rows: resize.rows,
            cwd,
            env: shellEnv,
          });
          const newEntry: PtyEntry = { process: ptyProcess, scrollback: "", currentWs: ws };
          ptyRegistry.set(terminalId, newEntry);

          ptyProcess.onData((data) => {
            const e = ptyRegistry.get(terminalId);
            if (!e) return;
            e.scrollback += data;
            if (e.scrollback.length > MAX_SCROLLBACK) {
              e.scrollback = e.scrollback.slice(-MAX_SCROLLBACK);
            }
            if (e.currentWs?.readyState === WebSocket.OPEN) {
              e.currentWs.send(data);
            }
          });

          ptyProcess.onExit(() => {
            const e = ptyRegistry.get(terminalId);
            if (e?.currentWs?.readyState === WebSocket.OPEN) {
              e.currentWs.close();
            }
            ptyRegistry.delete(terminalId);
          });
        } catch (err) {
          console.error("PTY spawn failed:", err);
          if (ws.readyState === WebSocket.OPEN) ws.close();
          return;
        }
      } else {
        entry.process.resize(resize.cols, resize.rows);
      }
      return;
    }

    ptyRegistry.get(terminalId)?.process.write(input);
  });

  ws.on("close", () => {
    const entry = ptyRegistry.get(terminalId);
    if (entry && entry.currentWs === ws) {
      entry.currentWs = null;
    }
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
        handlePTYConnection(ws, record.worktree.path, terminalId);
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
