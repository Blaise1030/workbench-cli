import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/vue-query";
import { ackSession, fetchSessions } from "./sessions-api";

export const sessionKeys = {
  all: ["sessions"] as const,
};

// No polling: the `sessions` SSE topic invalidates this on real changes (terminal
// register / state updates), and refetchOnWindowFocus self-heals any missed push.
export function sessionsQueryOptions() {
  return queryOptions({
    queryKey: sessionKeys.all,
    queryFn: fetchSessions,
    refetchOnWindowFocus: "always",
  });
}

export function useSessionsQuery() {
  return useQuery(sessionsQueryOptions());
}

export function useAckSessionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (terminalId: string) => ackSession(terminalId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: sessionKeys.all });
    },
  });
}
