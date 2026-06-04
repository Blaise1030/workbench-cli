import { useMutation, useQuery, useQueryClient } from "@tanstack/vue-query";
import { ensureOk } from "@/lib/api-error";
import type {
  AgentsResponse,
  ApplyAgentHooksResult,
  PatchWorkbenchAgent,
  WorkbenchAgent,
} from "@/modules/settings/types/agents";

export const agentsQueryKeys = {
  all: ["settings", "agents"] as const,
};

export function agentsQueryOptions() {
  return {
    queryKey: agentsQueryKeys.all,
    queryFn: async () => {
      const res = await fetch("/api/settings/agents", {
        credentials: "include",
      });
      return ensureOk<AgentsResponse>(res);
    },
  };
}

export function useAgentsQuery() {
  return useQuery(agentsQueryOptions());
}

export function usePatchAgentsMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (agents: Record<string, PatchWorkbenchAgent>) => {
      const res = await fetch("/api/settings/agents", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agents }),
      });
      return ensureOk<AgentsResponse>(res);
    },
    onSuccess: (data) => {
      qc.setQueryData(agentsQueryKeys.all, data);
    },
  });
}

export function useCreateAgentMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      name: string;
      startCommand: string;
      resumeCommand: string;
      matchBinaries?: string[];
    }) => {
      const res = await fetch("/api/settings/agents", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      return ensureOk<{ agent: WorkbenchAgent; settings: AgentsResponse }>(res);
    },
    onSuccess: (data) => {
      qc.setQueryData(agentsQueryKeys.all, data.settings);
    },
  });
}

export function useDeleteAgentMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/settings/agents/${encodeURIComponent(id)}`, {
        method: "DELETE",
        credentials: "include",
      });
      return ensureOk<AgentsResponse>(res);
    },
    onSuccess: (data) => {
      qc.setQueryData(agentsQueryKeys.all, data);
    },
  });
}

export function useApplyAgentHooksMutation() {
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(
        `/api/settings/agents/${encodeURIComponent(id)}/apply-hooks`,
        {
          method: "POST",
          credentials: "include",
        },
      );
      return ensureOk<ApplyAgentHooksResult>(res);
    },
  });
}
