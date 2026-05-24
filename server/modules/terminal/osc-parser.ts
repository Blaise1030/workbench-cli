export interface OscCommandReport {
  commandExit?: number;
  commandLine?: string;
}

function decodeCmdPart(part: string): string | undefined {
  if (part.startsWith("cmd_b64=")) {
    try {
      return Buffer.from(part.slice(8), "base64").toString("utf-8");
    } catch {
      return undefined;
    }
  }
  if (part.startsWith("cmd=")) {
    return part.slice(4);
  }
  return undefined;
}

export function parseOsc133Command(payload: string): OscCommandReport | null {
  const parts = payload.split(";");
  if (parts[0] !== "C") return null;

  let commandExit: number | undefined;
  let commandLine: string | undefined;

  for (const part of parts.slice(1)) {
    if (part.startsWith("exit=")) {
      const code = Number.parseInt(part.slice(5), 10);
      if (!Number.isNaN(code)) commandExit = code;
      continue;
    }
    const cmd = decodeCmdPart(part);
    if (cmd !== undefined) commandLine = cmd;
  }

  if (commandExit === undefined && commandLine === undefined) return null;
  return { commandExit, commandLine };
}

const OSC_RE = /\x1b\]([0-9]+);([\s\S]*?)(?:\x07|\x1b\\)/g;

export function parseOscStream(
  carry: string,
  chunk: string,
): { carry: string; reports: OscCommandReport[] } {
  const text = carry + chunk;
  const reports: OscCommandReport[] = [];
  let lastComplete = 0;

  for (const match of text.matchAll(OSC_RE)) {
    const index = match.index ?? 0;
    const code = match[1]!;
    const payload = match[2]!;
    lastComplete = index + match[0].length;

    if (code !== "133") continue;
    const report = parseOsc133Command(payload);
    if (report) reports.push(report);
  }

  const tail = text.slice(lastComplete);
  const carryStart = tail.lastIndexOf("\x1b]");
  const nextCarry = carryStart === -1 ? "" : tail.slice(carryStart);

  return { carry: nextCarry, reports };
}
