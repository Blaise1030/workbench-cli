import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/vue-query";
import type { LanPublicState } from "@server/schemas/api";
import { apiClient } from "@/lib/api-client";
import { ensureOk } from "@/lib/api-error";

export const settingsKeys = {
  all: ["settings"] as const,
  lan: () => [...settingsKeys.all, "lan"] as const,
};

export function lanSettingsQueryOptions() {
  return queryOptions({
    queryKey: settingsKeys.lan(),
    queryFn: async () => {
      const res = await apiClient.settings.lan.$get();
      return ensureOk<LanPublicState>(res);
    },
  });
}

export function useLanSettingsQuery() {
  return useQuery(lanSettingsQueryOptions());
}

export function useSetLanMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (enabled: boolean) => {
      const res = await apiClient.settings.lan.$post({ json: { enabled } });
      return ensureOk<LanPublicState>(res);
    },
    onSuccess: (data) => {
      queryClient.setQueryData(settingsKeys.lan(), data);
    },
  });
}

export function useRefreshInviteMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await apiClient.settings.lan["refresh-invite"].$post();
      return ensureOk<LanPublicState>(res);
    },
    onSuccess: (data) => {
      queryClient.setQueryData(settingsKeys.lan(), data);
    },
  });
}
