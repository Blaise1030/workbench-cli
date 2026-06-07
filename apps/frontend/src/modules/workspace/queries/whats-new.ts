import { queryOptions } from "@tanstack/vue-query";
import {
  WHATS_NEW_URL,
  readCachedWhatsNewEntries,
  writeCachedWhatsNewEntries,
  type WhatsNewEntry,
} from "@/modules/workspace/lib/whats-new";

export const whatsNewQueryOptions = () =>
  queryOptions({
    queryKey: ["whats-new"],
    queryFn: async () => {
      const res = await fetch(WHATS_NEW_URL);
      if (!res.ok) throw new Error("Failed to fetch what's new entries");
      const entries = (await res.json()) as WhatsNewEntry[];
      writeCachedWhatsNewEntries(entries);
      return entries;
    },
    placeholderData: readCachedWhatsNewEntries,
    staleTime: 60 * 60 * 1000,
    retry: 1,
  });
