import { useQuery } from "@tanstack/vue-query";
import { watchEffect } from "vue";
import { networkSettingsQueryOptions } from "@/modules/settings/queries/settings";
import { currentBrowserPort } from "@/modules/workspace/lib/worktree-env";

const BASE_TITLE = "workbench";

export function useWorkbenchDocumentTitle() {
  const { data: network } = useQuery(networkSettingsQueryOptions());

  watchEffect(() => {
    const isDev =
      network.value != null &&
      currentBrowserPort() === network.value.nonProdPort;
    document.title = isDev ? `[DEV] ${BASE_TITLE}` : BASE_TITLE;
  });
}
