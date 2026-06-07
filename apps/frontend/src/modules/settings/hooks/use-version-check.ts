import { computed } from "vue";
import { useLocalStorage } from "@vueuse/core";
import { useQuery } from "@tanstack/vue-query";
import {
  healthQueryOptions,
  isNewerVersion,
  latestManifestQueryOptions,
} from "@/modules/settings/queries/version";

const DISMISS_KEY = "workbench:update-dismissed";

export function useVersionCheck() {
  const health = useQuery(healthQueryOptions());
  const manifest = useQuery(latestManifestQueryOptions());
  const dismissedVersion = useLocalStorage(DISMISS_KEY, "");

  const currentVersion = computed(() => health.data.value?.version ?? "");
  const latestVersion = computed(() => manifest.data.value?.version ?? "");

  const hasNewerRelease = computed(() => {
    const current = currentVersion.value;
    const latest = latestVersion.value;
    if (!current || !latest) return false;
    return isNewerVersion(latest, current);
  });

  const updateAvailable = computed(() => {
    if (!hasNewerRelease.value) return false;
    return dismissedVersion.value !== latestVersion.value;
  });

  function dismissUpdate() {
    dismissedVersion.value = latestVersion.value;
  }

  return {
    currentVersion,
    latestVersion,
    hasNewerRelease,
    updateAvailable,
    isLoading: computed(() => !health.data.value && health.isPending.value),
    dismissUpdate,
  };
}
