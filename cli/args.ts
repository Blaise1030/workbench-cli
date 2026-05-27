export interface CliArgs {
  port: number;
  forceHttp: boolean;
  assumeYes: boolean;
  showHelp: boolean;
}

const HELP = `workbench-cli — local dev workbench in the browser

Usage:
  workbench-cli [options]

Options:
  -p, --port <number>   Port (default: 3000, or PORT env)
  --http, --insecure    Serve HTTP on localhost only (no mkcert)
  -y, --yes             Install mkcert without prompting if missing
  -h, --help            Show this help

LAN sharing in the UI requires mkcert (HTTPS). HTTP mode disables LAN until mkcert is installed.
Without --yes, the CLI asks before installing mkcert.
`;

export function parseCliArgs(argv: string[]): CliArgs {
  let port = parseInt(process.env.PORT ?? "3000", 10);
  let forceHttp = false;
  let assumeYes = false;
  let showHelp = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === "--help" || arg === "-h") {
      showHelp = true;
    } else if (arg === "--yes" || arg === "-y") {
      assumeYes = true;
    } else if (arg === "--http" || arg === "--insecure") {
      forceHttp = true;
    } else if (arg === "--port" || arg === "-p") {
      const next = argv[++i];
      if (!next) throw new Error("Missing value for --port");
      port = parseInt(next, 10);
      if (Number.isNaN(port)) throw new Error(`Invalid port: ${next}`);
    } else if (arg.startsWith("-")) {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  return { port, forceHttp, assumeYes, showHelp };
}

export function printCliHelp(): void {
  console.log(HELP);
}
