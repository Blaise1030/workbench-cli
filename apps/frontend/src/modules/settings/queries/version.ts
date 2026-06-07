import { queryOptions } from "@tanstack/vue-query";
import { LATEST_MANIFEST_URL } from "@/modules/settings/lib/release";

export interface HealthResponse {
  ok: boolean;
  server: string;
  version: string;
}

export interface LatestManifest {
  version: string;
  assets: Record<string, string>;
}

export const versionKeys = {
  all: ["version"] as const,
  health: () => [...versionKeys.all, "health"] as const,
  latest: () => [...versionKeys.all, "latest"] as const,
};

function parseVersion(version: string): [number, number, number] | null {
  const match = version.trim().replace(/^v/i, "").match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

export function isNewerVersion(latest: string, current: string): boolean {
  const latestParts = parseVersion(latest);
  const currentParts = parseVersion(current);
  if (!latestParts || !currentParts) return false;
  for (let i = 0; i < 3; i++) {
    if (latestParts[i] > currentParts[i]) return true;
    if (latestParts[i] < currentParts[i]) return false;
  }
  return false;
}

export function healthQueryOptions() {
  return queryOptions({
    queryKey: versionKeys.health(),
    queryFn: async () => {
      const res = await fetch("/api/health", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch server version");
      return (await res.json()) as HealthResponse;
    },
    staleTime: Infinity,
    gcTime: Infinity,
  });
}

export function latestManifestQueryOptions() {
  return queryOptions({
    queryKey: versionKeys.latest(),
    queryFn: async () => {
      const res = await fetch(LATEST_MANIFEST_URL);
      if (!res.ok) throw new Error("Failed to fetch latest release");
      return (await res.json()) as LatestManifest;
    },
    staleTime: 60 * 60 * 1000,
    gcTime: Infinity,
    retry: 1,
  });
}
