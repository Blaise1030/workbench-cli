import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { getDataDir } from "../../db/data-dir.js";

export const DEFAULT_NETWORK_HOST = "workbench.local";
export const DEFAULT_NETWORK_PORT = 4738;
/** Added to prod port for feature-branch / non-default worktree instances. */
export const NON_PROD_PORT_OFFSET = 1;

export function nonProdPort(prodPort: number): number {
  return prodPort + NON_PROD_PORT_OFFSET;
}

const HOST_PATTERN =
  /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$/i;

const networkConfigSchema = z.object({
  host: z
    .string()
    .min(1)
    .max(253)
    .refine((h) => HOST_PATTERN.test(h), "Invalid hostname"),
  port: z.number().int().min(1).max(65535),
});

export type NetworkConfig = z.infer<typeof networkConfigSchema>;

export type PatchNetworkConfig = Partial<NetworkConfig>;

export function getNetworkConfigPath(): string {
  return join(getDataDir(), "config.json");
}

export function defaultNetworkConfig(): NetworkConfig {
  return { host: DEFAULT_NETWORK_HOST, port: DEFAULT_NETWORK_PORT };
}

export function loadNetworkConfig(): NetworkConfig {
  const path = getNetworkConfigPath();
  if (!existsSync(path)) return defaultNetworkConfig();
  try {
    const raw = JSON.parse(readFileSync(path, "utf8")) as unknown;
    const parsed = networkConfigSchema.safeParse(raw);
    if (parsed.success) return parsed.data;
  } catch {
    // fall through
  }
  return defaultNetworkConfig();
}

export function saveNetworkConfig(patch: PatchNetworkConfig): NetworkConfig {
  const current = loadNetworkConfig();
  const next = networkConfigSchema.parse({ ...current, ...patch });
  const dir = getDataDir();
  mkdirSync(dir, { recursive: true });
  writeFileSync(getNetworkConfigPath(), `${JSON.stringify(next, null, 2)}\n`, "utf8");
  return next;
}

export interface ResolveNetworkOptions {
  port?: number;
  host?: string;
}

/** Merge saved config with env and explicit overrides (CLI). */
export function resolveNetworkConfig(options: ResolveNetworkOptions = {}): NetworkConfig {
  const file = loadNetworkConfig();
  const envPort = process.env.PORT ? parseInt(process.env.PORT, 10) : undefined;
  const envHost = process.env.WORKBENCH_HOST?.trim() || undefined;

  const port = options.port ?? (Number.isFinite(envPort) ? envPort! : file.port);
  const host = options.host ?? envHost ?? file.host;

  return networkConfigSchema.parse({ host, port });
}

export function hostsFileLine(host: string): string {
  return `127.0.0.1 ${host}`;
}

export function configDiffersFromRunning(
  saved: NetworkConfig,
  running: NetworkConfig,
): boolean {
  return saved.host !== running.host || saved.port !== running.port;
}
