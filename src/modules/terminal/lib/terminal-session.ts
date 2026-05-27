import type { Terminal } from "@xterm/xterm";
import { notifyCommandSuccess } from "@/modules/terminal/lib/terminal-bell";
import {
  formatTabLabel,
  parseOscStream,
  type TerminalOscReport,
} from "@/modules/terminal/lib/terminal-reports";

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
  private terminal: Terminal | null = null;
  private oscCarry = "";
  private onLabelChange?: (label: string) => void;
  private shouldNotifySuccess: () => boolean = () => true;
  private disposed = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private hasConnected = false;

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

  /** When false, successful commands do not notify in the background (e.g. focused tab). */
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
    const params = new URLSearchParams({ terminalId: this.terminalId });
    if (this.hasConnected) params.set("skipReplay", "1");
    const ws = new WebSocket(`${proto}//${location.host}/ws?${params}`);
    this.ws = ws;

    ws.onmessage = (event: MessageEvent<string>) => {
      this.handleOutput(event.data);
    };

    ws.onopen = () => {
      this.hasConnected = true;
      this.sendResize(this.cols, this.rows);
    };

    ws.onclose = () => {
      this.ws = null;
      if (!this.disposed) {
        this.reconnectTimer = setTimeout(() => {
          this.reconnectTimer = null;
          this.oscCarry = "";
          this.connect();
        }, 250);
      }
    };
  }

  attach(terminal: Terminal, options?: { reset?: boolean }) {
    this.terminal = terminal;
    if (options?.reset) {
      terminal.reset();
    }
    if (this.buffer) {
      terminal.write(this.buffer);
    }
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
    this.disposed = true;
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.detach();
    this.ws?.close();
    this.ws = null;
  }
}
