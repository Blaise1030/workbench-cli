import { apiClient } from "@/lib/api-client";
import { ensureOk } from "@/lib/api-error";

/** Auto-authenticate when the UI is served from the same machine as the server.
 *  If an invite token is provided (from QR), it will be sent for validation.
 */
export async function ensureLocalAuth(token?: string): Promise<void> {
  const body = token ? { token } : {};
  const res = await apiClient.auth.local.$post({ json: body });
  await ensureOk<{ ok: true }>(res);
}
