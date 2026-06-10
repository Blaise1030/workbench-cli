import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/vue-query";
import { ackSession, fetchSessions } from "./sessions-api";

export const sessionKeys = {
  all: ["sessions"] as const,
};

export function sessionsQueryOptions() {
  return queryOptions({
    queryKey: sessionKeys.all,
    queryFn: fetchSessions,
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
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
