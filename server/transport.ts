import { ensureTLS, type TLSCredentials } from "./tls.js";

export type TransportScheme = "http" | "https";

export interface ServerTransport {
  scheme: TransportScheme;
  tls: TLSCredentials | null;
}

export interface ResolveTransportOptions {
  hosts: string[];
  /** LAN and other non-localhost binds must use HTTPS. */
  requireTls?: boolean;
  /** Skip TLS (localhost only). */
  forceHttp?: boolean;
  /** Run brew/apt mkcert install when missing. Default true unless forceHttp. */
  autoInstallMkcert?: boolean;
  /** CLI prompt (or --yes) before installing mkcert. */
  confirmMkcertInstall?: () => Promise<boolean>;
}

export const LAN_REQUIRES_TLS_MESSAGE =
  "LAN sharing requires HTTPS. Install mkcert: https://github.com/FiloSottile/mkcert#installation";

function isLocalhostOnlyHosts(hosts: string[]): boolean {
  return hosts.every((host) => host === "localhost" || host === "127.0.0.1");
}

function warnHttpFallback(reason: string): void {
  console.warn("\n  ⚠ Serving over HTTP on localhost only (not encrypted).");
  console.warn(`  ${reason}`);
  console.warn(
    "  Install mkcert for HTTPS: https://github.com/FiloSottile/mkcert#installation\n",
  );
}

export async function resolveTransport(
  options: ResolveTransportOptions,
): Promise<ServerTransport> {
  const { hosts, requireTls = false, forceHttp = false } = options;
  const autoInstall = options.autoInstallMkcert ?? !forceHttp;

  if (hosts.length === 0) {
    throw new Error("resolveTransport requires at least one host");
  }

  if (forceHttp) {
    if (requireTls) {
      throw new Error("Cannot use HTTP when TLS is required");
    }
    if (!isLocalhostOnlyHosts(hosts)) {
      throw new Error("HTTP mode is only allowed for localhost");
    }
    warnHttpFallback("Started with --http.");
    return { scheme: "http", tls: null };
  }

  try {
    const tls = await ensureTLS(hosts, {
      autoInstall,
      confirmInstall: options.confirmMkcertInstall,
    });
    return { scheme: "https", tls };
  } catch (err) {
    if (requireTls) {
      const detail = err instanceof Error ? err.message : String(err);
      throw new Error(`${LAN_REQUIRES_TLS_MESSAGE} (${detail})`);
    }
    if (!isLocalhostOnlyHosts(hosts)) {
      throw err;
    }
    const detail = err instanceof Error ? err.message : String(err);
    warnHttpFallback(detail);
    return { scheme: "http", tls: null };
  }
}

export function formatOrigin(scheme: TransportScheme, host: string, port: number): string {
  return `${scheme}://${host}:${port}/`;
}
