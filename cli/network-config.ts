import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export const DEFAULT_NETWORK_HOST = "workbench.local";
export const DEFAULT_NETWORK_PORT = 4738;
/** Added to prod port for feature-branch / non-default worktree instances. */
export const NON_PROD_PORT_OFFSET = 1;

export function nonProdPort(prodPort: number): number {
  return prodPort + NON_PROD_PORT_OFFSET;
}

export interface NetworkConfig {
  host: string;
  port: number;
}

function dataDir(): string {
  return join(homedir(), ".workbench");
}

export function getNetworkConfigPath(): string {
  return join(dataDir(), "config.json");
}

export function defaultNetworkConfig(): NetworkConfig {
  return { host: DEFAULT_NETWORK_HOST, port: DEFAULT_NETWORK_PORT };
}

export function loadNetworkConfig(): NetworkConfig {
  const defaults = defaultNetworkConfig();
  const path = getNetworkConfigPath();
  if (!existsSync(path)) return defaults;
  try {
    const raw = JSON.parse(readFileSync(path, "utf8")) as Partial<NetworkConfig>;
    const host = typeof raw.host === "string" && raw.host.trim() ? raw.host.trim() : defaults.host;
    const port =
      typeof raw.port === "number" && raw.port > 0 && raw.port <= 65535 ? raw.port : defaults.port;
    return { host, port };
  } catch {
    return defaults;
  }
}
