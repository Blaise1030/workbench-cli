import type { Server } from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import type { Session } from "../auth/session.js";
import { validateSession, activateSession } from "../auth/session.js";
import { isLoopbackAddress } from "../auth/local.js";
import type { AppDatabase } from "../../db/index.js";
import { getTerminalWithWorktree, TerminalError } from "../workspace/terminals.js";
import type { PtyRegistry } from "./pty-registry.js";

function parseSid(cookieHeader: string | undefined): string {
  if (!cookieHeader) return "";
  const match = cookieHeader.match(/(?:^|;\s*)sid=([^;]+)/);
  return match?.[1] ?? "";
}

function parseTerminalId(url: URL): string {
  return url.searchParams.get("terminalId")?.trim() ?? "";
}

function bindTerminalSocket(
  registry: PtyRegistry,
  terminalId: string,
  ws: WebSocket,
  ctx: {
    cwd: string;
    resumeCommand?: string | null;
    resumeTrusted?: boolean;
    agentKind?: string | null;
    agentSessionId?: string | null;
  },
): void {
  void registry.attach(terminalId, ws, ctx);

  ws.on("message", (msg: Buffer | string) => {
    const input = typeof msg === "string" ? msg : msg.toString("utf-8");
    void registry.handleMessage(terminalId, ws, input);
  });

  ws.on("close", () => {
    registry.detach(terminalId, ws);
  });
}

export function attachWebSocketUpgrade(
  httpServer: Server,
  wss: WebSocketServer,
  session: Session,
  database: AppDatabase,
  registry: PtyRegistry,
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
        bindTerminalSocket(registry, terminalId, ws, {
          cwd: record.worktree.path,
          resumeCommand: record.terminal.resumeCommand,
          resumeTrusted: record.terminal.resumeTrusted,
          agentKind: record.terminal.agentKind,
          agentSessionId: record.terminal.agentSessionId,
        });
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
