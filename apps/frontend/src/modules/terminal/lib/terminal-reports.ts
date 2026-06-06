/** Basename of a POSIX path (e.g. `/Users/me/v2` → `v2`). */
export function pathBasename(path: string): string {
  const normalized = path.replace(/\/$/, "") || "/";
  const i = normalized.lastIndexOf("/");
  if (i === -1) return normalized;
  return normalized.slice(i + 1) || "/";
}

function parseOsc7Path(payload: string): string | null {
  const trimmed = payload.trim();
  if (!trimmed.startsWith("file://")) return null;
  try {
    const url = new URL(trimmed);
    return decodeURIComponent(url.pathname || "/");
  } catch {
    const withoutHost = trimmed.replace(/^file:\/\/[^/]*/, "");
    return decodeURIComponent(withoutHost || "/");
  }
}

export interface TerminalOscReport {
  title?: string;
  cwd?: string;
  /** Set when OSC 133 reports command finished (shell integration). */
  commandExit?: number;
  /** Command line from shell integration (OSC 133;C;cmd_b64=…). */
  commandLine?: string;
}

function parseOsc133Exit(payload: string): { commandExit?: number; commandLine?: string } {
  const parts = payload.split(";");
  if (parts[0] !== "C") return {};
  let commandExit: number | undefined;
  let commandLine: string | undefined;
  for (const part of parts.slice(1)) {
    if (part.startsWith("exit=")) {
      const code = Number.parseInt(part.slice(5), 10);
      if (!Number.isNaN(code)) commandExit = code;
    } else if (part.startsWith("cmd_b64=")) {
      try {
        commandLine = Buffer.from(part.slice(8), "base64").toString("utf-8");
      } catch {
        // ignore
      }
    } else if (part.startsWith("cmd=")) {
      commandLine = part.slice(4);
    }
  }
  return { commandExit, commandLine };
}

const OSC_RE = /\x1b\]([0-9]+);([\s\S]*?)(?:\x07|\x1b\\)/g;

/**
 * Extract completed OSC sequences from streamed PTY output.
 * Returns leftover bytes that may be an incomplete sequence.
 */
export function parseOscStream(
  carry: string,
  chunk: string,
): { carry: string; reports: TerminalOscReport[] } {
  const text = carry + chunk;
  const reports: TerminalOscReport[] = [];
  let lastComplete = 0;

  for (const match of text.matchAll(OSC_RE)) {
    const index = match.index ?? 0;
    const code = match[1]!;
    const payload = match[2]!;
    lastComplete = index + match[0].length;

    const report: TerminalOscReport = {};
    if (code === "0" || code === "2") {
      report.title = payload.trim();
    } else if (code === "7") {
      const cwd = parseOsc7Path(payload);
      if (cwd) report.cwd = cwd;
    } else if (code === "133") {
      const { commandExit, commandLine } = parseOsc133Exit(payload);
      if (commandExit !== undefined) report.commandExit = commandExit;
      if (commandLine !== undefined) report.commandLine = commandLine;
    }

    if (report.title || report.cwd || report.commandExit !== undefined) {
      reports.push(report);
    }
  }

  const tail = text.slice(lastComplete);
  const carryStart = tail.lastIndexOf("\x1b]");
  const nextCarry = carryStart === -1 ? "" : tail.slice(carryStart);

  return { carry: nextCarry, reports };
}

export function shellBasename(shellPath: string): string {
  const base = shellPath.split("/").pop() ?? "sh";
  return base === "bash" || base === "zsh" || base === "fish" ? base : base;
}

export function formatTabLabel(options: {
  cwd: string | null;
  windowTitle: string | null;
  shellName: string;
  fallback: string;
}): string {
  const { cwd, windowTitle, shellName, fallback } = options;
  if (windowTitle) return windowTitle;
  const dir = cwd ? pathBasename(cwd) : null;
  if (dir) return `${dir} — ${shellName}`;
  return shellName || fallback;
}
