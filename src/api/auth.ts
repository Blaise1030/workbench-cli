import { useMutation } from "@tanstack/vue-query";
import { apiClient } from "@/lib/api-client";
import { ensureOk } from "@/lib/api-error";

export function useAuthMutation() {
  return useMutation({
    mutationFn: async (token: string) => {
      const res = await apiClient.auth.$post({ json: { token } });
      return ensureOk<{ ok: true }>(res);
    },
  });
}
