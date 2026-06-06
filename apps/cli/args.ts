import {
  DEFAULT_NETWORK_HOST,
  DEFAULT_NETWORK_PORT,
  loadNetworkConfig,
} from "./network-config.js";

export interface CliArgs {
  port: number;
  host: string;
  forceHttp: boolean;
  assumeYes: boolean;
  showHelp: boolean;
}

const HELP = `workbench-cli — local dev workbench in the browser

Usage:
  workbench-cli [options]

Options:
  -p, --port <number>   Port (default: ${DEFAULT_NETWORK_PORT}, or PORT env, or ~/.workbench/config.json)
  --host <hostname>     Local hostname (default: ${DEFAULT_NETWORK_HOST}, or WORKBENCH_HOST env)
  --http, --insecure    Serve HTTP on localhost only (no mkcert)
  -y, --yes             Install mkcert without prompting if missing
  -h, --help            Show this help

HTTPS uses mkcert for trusted local certificates. HTTP mode skips mkcert.
Without --yes, the CLI asks before installing mkcert.

Add to /etc/hosts once: 127.0.0.1 ${DEFAULT_NETWORK_HOST}
`;

export function parseCliArgs(argv: string[]): CliArgs {
  const fileConfig = loadNetworkConfig();
  let port = parseInt(process.env.PORT ?? String(fileConfig.port), 10);
  let host = process.env.WORKBENCH_HOST?.trim() || fileConfig.host;
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
    } else if (arg === "--host") {
      const next = argv[++i];
      if (!next) throw new Error("Missing value for --host");
      host = next;
    } else if (arg.startsWith("-")) {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  return { port, host, forceHttp, assumeYes, showHelp };
}

export function printCliHelp(): void {
  console.log(HELP);
}
