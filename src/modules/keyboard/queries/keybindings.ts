import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/vue-query";
import { apiClient } from "@/lib/api-client";
import { ensureOk } from "@/lib/api-error";
import type { KeybindingsMap } from "../types";
import { DEFAULT_KEYBINDINGS } from "../defaults";

export const keybindingsKeys = {
  all: ["keybindings"] as const,
};

export function keybindingsQueryOptions() {
  return queryOptions({
    queryKey: keybindingsKeys.all,
    queryFn: async () => {
      const res = await apiClient.keybindings.$get();
      return ensureOk<KeybindingsMap>(res);
    },
    placeholderData: DEFAULT_KEYBINDINGS,
  });
}

export function useKeybindingsQuery() {
  return useQuery(keybindingsQueryOptions());
}

export function useUpdateKeybindingsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (map: KeybindingsMap) => {
      const res = await apiClient.keybindings.$put({ json: map });
      return ensureOk<KeybindingsMap>(res);
    },
    onSuccess: (data) => {
      queryClient.setQueryData(keybindingsKeys.all, data);
    },
  });
}
