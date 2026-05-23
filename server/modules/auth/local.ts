import type { Context } from "hono";
import { getConnInfo } from "@hono/node-server/conninfo";

/** True for loopback TCP peers (same machine as the server). */
export function isLoopbackAddress(address: string | undefined): boolean {
  if (!address) return false;
  if (address === "127.0.0.1" || address === "::1" || address === "::ffff:127.0.0.1") {
    return true;
  }
  return address.startsWith("127.");
}

export function getClientAddress(c: Context): string {
  try {
    const info = getConnInfo(c);
    return info.remote?.address ?? "";
  } catch {
    return "";
  }
}

export function isLocalRequest(c: Context): boolean {
  return isLoopbackAddress(getClientAddress(c));
}
