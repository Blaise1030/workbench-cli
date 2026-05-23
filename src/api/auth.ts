import { useMutation } from "@tanstack/vue-query";
import { apiClient } from "@/lib/api-client";
import { ensureOk } from "@/lib/api-error";

/** Auto-authenticate when the UI is served from localhost (same machine as server). */
export async function ensureLocalAuth(): Promise<void> {
  const res = await apiClient.auth.local.$post();
  await ensureOk<{ ok: true }>(res);
}

export function useAuthMutation() {
  return useMutation({
    mutationFn: async (token: string) => {
      const res = await apiClient.auth.$post({ json: { token } });
      return ensureOk<{ ok: true }>(res);
    },
  });
}
