import type { WTerm as WTermInstance } from "@wterm/vue";
import { notifyCommandSuccess, playTerminalBell } from "@/lib/terminal-bell";
import {
  formatTabLabel,
  parseOscStream,
  type TerminalOscReport,
} from "@/lib/terminal-reports";

const CLEAR_SCREEN = "\x1b[2J\x1b[H";

export interface TerminalSessionMeta {
  id: string;
  title: string;
  terminalId: string;
}

export class TerminalSession {
  readonly id: string;
  readonly terminalId: string;
  readonly fallbackTitle: string;
  readonly shellName: string;

  cwd: string | null = null;
  windowTitle: string | null = null;
  buffer = "";
  ws: WebSocket | null = null;

  private cols = 80;
  private rows = 24;
  private terminal: WTermInstance | null = null;
  private oscCarry = "";
  private onLabelChange?: (label: string) => void;
  private shouldNotifySuccess: () => boolean = () => true;

  constructor(meta: TerminalSessionMeta) {
    this.id = meta.id;
    this.terminalId = meta.terminalId;
    this.fallbackTitle = meta.title;
    this.shellName = "zsh";
    this.connect();
  }

  get tabLabel(): string {
    return formatTabLabel({
      cwd: this.cwd,
      windowTitle: this.windowTitle,
      shellName: this.shellName,
      fallback: this.fallbackTitle,
    });
  }

  setOnLabelChange(callback: (label: string) => void) {
    this.onLabelChange = callback;
    callback(this.tabLabel);
  }

  /** When false, successful commands do not ring the bell (e.g. focused tab). */
  setShouldNotifySuccess(callback: () => boolean) {
    this.shouldNotifySuccess = callback;
  }

  setWindowTitle(title: string) {
    const next = title.trim();
    if (!next || next === this.windowTitle) return;
    this.windowTitle = next;
    this.emitLabel();
  }

  private emitLabel() {
    this.onLabelChange?.(this.tabLabel);
  }

  private applyReports(reports: TerminalOscReport[]) {
    let changed = false;
    for (const report of reports) {
      if (report.cwd && report.cwd !== this.cwd) {
        this.cwd = report.cwd;
        changed = true;
      }
      if (report.title && report.title !== this.windowTitle) {
        this.windowTitle = report.title;
        changed = true;
      }
      if (report.commandExit === 0 && this.shouldNotifySuccess()) {
        playTerminalBell();
        notifyCommandSuccess(this.tabLabel);
      }
    }
    if (changed) this.emitLabel();
  }

  private handleOutput(chunk: string) {
    const { carry, reports } = parseOscStream(this.oscCarry, chunk);
    this.oscCarry = carry;
    this.applyReports(reports);
    this.buffer += chunk;
    this.terminal?.write(chunk);
  }

  private connect() {
    const proto = location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(
      `${proto}//${location.host}/ws?terminalId=${encodeURIComponent(this.terminalId)}`,
    );
    this.ws = ws;

    ws.onmessage = (event: MessageEvent<string>) => {
      this.handleOutput(event.data);
    };

    ws.onopen = () => {
      this.sendResize(this.cols, this.rows);
    };

    ws.onclose = () => {
      const ended = "\r\n\x1b[90m[session ended — reload to reconnect]\x1b[0m\r\n";
      this.handleOutput(ended);
      this.ws = null;
    };
  }

  attach(terminal: WTermInstance) {
    this.terminal = terminal;
    terminal.write(CLEAR_SCREEN);
    if (this.buffer) terminal.write(this.buffer);
    this.sendResize(terminal.cols, terminal.rows);
    terminal.focus();
  }

  detach() {
    this.terminal = null;
  }

  sendInput(data: string) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(data);
    }
  }

  sendResize(cols: number, rows: number) {
    this.cols = cols;
    this.rows = rows;
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(`\x1b[RESIZE:${cols};${rows}]`);
    }
  }

  dispose() {
    this.detach();
    this.ws?.close();
    this.ws = null;
  }
}
