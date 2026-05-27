import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/vue-query";
import { computed, type MaybeRefOrGetter, toValue } from "vue";
import { apiClient } from "@/lib/api-client";
import { ensureOk } from "@/lib/api-error";
import { workspaceKeys } from "@/modules/workspace/queries/keys";
import type { TerminalTab } from "./types";

export function terminalsQueryOptions(worktreeId: MaybeRefOrGetter<string>) {
  return queryOptions({
    queryKey: computed(() => workspaceKeys.terminals(toValue(worktreeId))),
    queryFn: async () => {
      const id = toValue(worktreeId);
      const res = await apiClient.worktrees[":id"].terminals.$get({
        param: { id },
      });
      const data = await ensureOk<{ terminals: TerminalTab[] }>(res);
      return data.terminals;
    },
    enabled: computed(() => Boolean(toValue(worktreeId))),
  });
}

export function useTerminalsQuery(worktreeId: MaybeRefOrGetter<string>) {
  return useQuery(terminalsQueryOptions(worktreeId));
}

export function useCreateTerminalMutation(worktreeId: MaybeRefOrGetter<string>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (title?: string) => {
      const res = await apiClient.worktrees[":id"].terminals.$post({
        param: { id: toValue(worktreeId) },
        json: title ? { title } : {},
      });
      const data = await ensureOk<{ terminal: TerminalTab }>(res);
      return data.terminal;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: workspaceKeys.terminals(toValue(worktreeId)),
      });
    },
  });
}

export function useUpdateTerminalMutation(worktreeId: MaybeRefOrGetter<string>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      terminalId,
      patch,
    }: {
      terminalId: string;
      patch: {
        title?: string;
        sortOrder?: number;
        resumeCommand?: string | null;
        resumeTrusted?: boolean;
      };
    }) => {
      const res = await apiClient.terminals[":id"].$patch({
        param: { id: terminalId },
        json: patch,
      });
      const data = await ensureOk<{ terminal: TerminalTab }>(res);
      return data.terminal;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: workspaceKeys.terminals(toValue(worktreeId)),
      });
    },
  });
}

export function useDeleteTerminalMutation(worktreeId: MaybeRefOrGetter<string>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (terminalId: string) => {
      const res = await apiClient.terminals[":id"].$delete({
        param: { id: terminalId },
      });
      await ensureOk<{ ok: true }>(res);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: workspaceKeys.terminals(toValue(worktreeId)),
      });
    },
  });
}
