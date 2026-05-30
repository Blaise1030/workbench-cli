import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/vue-query";
import type {
  ApprovedResumePrefix,
  NetworkSettings,
  PatchNetworkSettings,
  TerminalSettings,
} from "@server/schemas/api";
import { apiClient } from "@/lib/api-client";
import { ensureOk } from "@/lib/api-error";

export const settingsKeys = {
  all: ["settings"] as const,
  network: () => [...settingsKeys.all, "network"] as const,
  terminal: () => [...settingsKeys.all, "terminal"] as const,
  resumePrefixes: () => [...settingsKeys.all, "terminal", "resume-prefixes"] as const,
};

export function networkSettingsQueryOptions() {
  return queryOptions({
    queryKey: settingsKeys.network(),
    queryFn: async () => {
      const res = await apiClient.settings.network.$get();
      return ensureOk<NetworkSettings>(res);
    },
  });
}

export function terminalSettingsQueryOptions() {
  return queryOptions({
    queryKey: settingsKeys.terminal(),
    queryFn: async () => {
      const res = await apiClient.settings.terminal.$get();
      return ensureOk<TerminalSettings>(res);
    },
  });
}

export function terminalResumePrefixesQueryOptions() {
  return queryOptions({
    queryKey: settingsKeys.resumePrefixes(),
    queryFn: async () => {
      const res = await apiClient.settings.terminal["resume-commands"].$get();
      return ensureOk<{ approvedPrefixes: ApprovedResumePrefix[] }>(res);
    },
  });
}

export function useNetworkSettingsQuery() {
  return useQuery(networkSettingsQueryOptions());
}

export function useTerminalSettingsQuery() {
  return useQuery(terminalSettingsQueryOptions());
}

export function useTerminalResumePrefixesQuery() {
  return useQuery(terminalResumePrefixesQueryOptions());
}

export function usePatchNetworkSettingsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (patch: PatchNetworkSettings) => {
      const res = await apiClient.settings.network.$patch({ json: patch });
      return ensureOk<NetworkSettings>(res);
    },
    onSuccess: (data) => {
      queryClient.setQueryData(settingsKeys.network(), data);
    },
  });
}

export function usePatchTerminalSettingsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Partial<TerminalSettings>) => {
      const res = await apiClient.settings.terminal.$patch({ json: patch });
      return ensureOk<TerminalSettings>(res);
    },
    onSuccess: (data) => {
      queryClient.setQueryData(settingsKeys.terminal(), data);
    },
  });
}

export function useAddResumePrefixMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: { prefix: string; label?: string; cwd?: string }) => {
      const res = await apiClient.settings.terminal["resume-commands"].$post({ json: body });
      return ensureOk<{ prefix: ApprovedResumePrefix }>(res);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: settingsKeys.resumePrefixes() });
    },
  });
}

export function useRevokeResumePrefixMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await apiClient.settings.terminal["resume-commands"][":id"].$delete({
        param: { id },
      });
      return ensureOk<{ ok: true }>(res);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: settingsKeys.resumePrefixes() });
    },
  });
}
