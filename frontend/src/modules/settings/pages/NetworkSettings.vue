<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import SettingsPage from "@/modules/settings/components/SettingsPage.vue";
import SettingsSection from "@/modules/settings/components/SettingsSection.vue";
import SettingsRow from "@/modules/settings/components/SettingsRow.vue";
import {
  useNetworkSettingsQuery,
  usePatchNetworkSettingsMutation,
} from "@/modules/settings/queries/settings";
import { ApiError } from "@/lib/api-error";

const { data: networkData, isPending: networkPending } = useNetworkSettingsQuery();
const patchNetwork = usePatchNetworkSettingsMutation();

const localUrl = computed(() => networkData.value?.localUrl ?? "");
const pendingRestart = computed(() => networkData.value?.pendingRestart ?? false);
const hostsFileLine = computed(() => networkData.value?.hostsFileLine ?? "");

const hostInput = ref("");
const portInput = ref("");
const savedMessage = ref("");

watch(
  networkData,
  (n) => {
    if (!n) return;
    hostInput.value = n.host;
    portInput.value = String(n.port);
  },
  { immediate: true },
);

const error = ref("");

const loading = computed(() => networkPending.value || patchNetwork.isPending.value);

const networkDirty = computed(() => {
  const n = networkData.value;
  if (!n) return false;
  const port = parseInt(portInput.value, 10);
  return hostInput.value !== n.host || port !== n.port;
});

function mutationErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiError) return err.message;
  return fallback;
}

async function saveNetwork(): Promise<void> {
  error.value = "";
  savedMessage.value = "";
  const port = parseInt(portInput.value, 10);
  if (Number.isNaN(port) || port < 1 || port > 65535) {
    error.value = "Port must be between 1 and 65535.";
    return;
  }
  try {
    await patchNetwork.mutateAsync({
      host: hostInput.value.trim(),
      port,
    });
    savedMessage.value = "Saved. Restart workbench-cli for changes to take effect.";
  } catch (err) {
    error.value = mutationErrorMessage(err, "Failed to save network settings.");
  }
}

async function copyHostsLine() {
  if (!hostsFileLine.value) return;
  try {
    await navigator.clipboard.writeText(hostsFileLine.value);
    savedMessage.value = "Copied hosts line to clipboard.";
  } catch {
    error.value = "Could not copy to clipboard.";
  }
}
</script>

<template>
  <SettingsPage
    title="Network"
    description="Local address and port for this terminal."
  >
    <div v-if="error" class="border-b border-destructive/30 bg-destructive/10 px-8 py-3 text-sm text-destructive">
      {{ error }}
    </div>
    <div
      v-else-if="savedMessage"
      class="border-b border-border bg-muted/40 px-8 py-3 text-sm text-muted-foreground"
    >
      {{ savedMessage }}
    </div>

    <SettingsSection title="Local address">
      <SettingsRow
        label="Current URL"
        :description="localUrl || 'Loading…'"
      />

      <div
        v-if="pendingRestart"
        class="mx-8 mb-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-900 dark:text-amber-100"
      >
        Restart <code class="text-xs">workbench-cli</code> (or <code class="text-xs">npm run dev</code>) to apply host or port changes.
      </div>

      <SettingsRow
        label="Hostname"
        description="Friendly name for this machine. Add the hosts line below once if the browser cannot resolve it."
      >
        <Input
          v-model="hostInput"
          class="w-48 font-mono text-sm"
          :disabled="loading"
          autocomplete="off"
          spellcheck="false"
        />
      </SettingsRow>

      <SettingsRow label="Port" description="Avoid 3000 — many dev tools use it.">
        <Input
          v-model="portInput"
          type="number"
          min="1"
          max="65535"
          class="w-28 font-mono text-sm"
          :disabled="loading"
        />
      </SettingsRow>

      <SettingsRow
        v-if="hostsFileLine"
        label="/etc/hosts"
        description="One-time setup so your browser can open the hostname."
      >
        <div class="flex max-w-md items-center gap-2">
          <code class="truncate rounded bg-muted px-2 py-1 text-xs">{{ hostsFileLine }}</code>
          <Button variant="outline" size="sm" :disabled="loading" @click="copyHostsLine">
            Copy
          </Button>
        </div>
      </SettingsRow>

      <div class="flex justify-end px-8 pb-4">
        <Button :disabled="loading || !networkDirty" @click="saveNetwork">
          Save
        </Button>
      </div>
    </SettingsSection>
  </SettingsPage>
</template>
