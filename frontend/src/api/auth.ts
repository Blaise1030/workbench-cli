import { apiClient } from "@/lib/api-client";
import { ensureOk } from "@/lib/api-error";

/** Auto-authenticate when the UI is served from the same machine as the server. */
export async function ensureLocalAuth(): Promise<void> {
  const res = await apiClient.auth.local.$post();
  await ensureOk<{ ok: true }>(res);
}
