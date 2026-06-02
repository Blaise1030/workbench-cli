import { queryOptions, useQuery } from "@tanstack/vue-query";
import { fetchSessions } from "./sessions-api";

export const sessionKeys = {
  all: ["sessions"] as const,
};

export function sessionsQueryOptions() {
  return queryOptions({
    queryKey: sessionKeys.all,
    queryFn: fetchSessions,
    refetchInterval: 3_000,
  });
}

export function useSessionsQuery() {
  return useQuery(sessionsQueryOptions());
}
