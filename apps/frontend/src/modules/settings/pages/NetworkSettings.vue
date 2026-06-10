<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { toast } from "vue-sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemTitle,
} from "@/components/ui/item";
import SettingsPage from "@/modules/settings/components/SettingsPage.vue";
import SettingsSection from "@/modules/settings/components/SettingsSection.vue";
import {
  useNetworkSettingsQuery,
  usePatchNetworkSettingsMutation,
} from "@/modules/settings/queries/settings";
import { ApiError } from "@/lib/api-error";
import { buildHostsSetupPrompt } from "@/modules/settings/lib/hosts-setup-prompt";
import { buildTlsSetupPrompt } from "@/modules/settings/lib/tls-setup-prompt";

const { data: networkData, isPending: networkPending } = useNetworkSettingsQuery();
const patchNetwork = usePatchNetworkSettingsMutation();

const localUrl = computed(() => networkData.value?.localUrl ?? "");
const pendingRestart = computed(() => networkData.value?.pendingRestart ?? false);
const hostsFileLine = computed(() => networkData.value?.hostsFileLine ?? "");
const setupPrompt = computed(() =>
  networkData.value?.host ? buildHostsSetupPrompt(networkData.value.host) : "",
);
const tlsSetupPrompt = computed(() =>
  networkData.value?.host && networkData.value.scheme === "http"
    ? buildTlsSetupPrompt(networkData.value.host)
    : "",
);

const hostInput = ref("");
const portInput = ref("");

watch(
  networkData,
  (n) => {
    if (!n) return;
    hostInput.value = n.host;
    portInput.value = String(n.port);
  },
  { immediate: true },
);

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
  const port = parseInt(portInput.value, 10);
  if (Number.isNaN(port) || port < 1 || port > 65535) {
    toast.error("Port must be between 1 and 65535.");
    return;
  }
  try {
    await patchNetwork.mutateAsync({
      host: hostInput.value.trim(),
      port,
    });
    toast.success("Saved. Restart workbench-cli for changes to take effect.");
  } catch (err) {
    toast.error(mutationErrorMessage(err, "Failed to save network settings."));
  }
}

async function copyHostsLine() {
  if (!hostsFileLine.value) return;
  try {
    await navigator.clipboard.writeText(hostsFileLine.value);
    toast.success("Copied hosts line to clipboard.");
  } catch {
    toast.error("Could not copy to clipboard.");
  }
}

async function copySetupPrompt() {
  if (!setupPrompt.value) return;
  try {
    await navigator.clipboard.writeText(setupPrompt.value);
    toast.success("Copied setup prompt to clipboard.");
  } catch {
    toast.error("Could not copy to clipboard.");
  }
}

async function copyTlsSetupPrompt() {
  if (!tlsSetupPrompt.value) return;
  try {
    await navigator.clipboard.writeText(tlsSetupPrompt.value);
    toast.success("Copied HTTPS setup prompt to clipboard.");
  } catch {
    toast.error("Could not copy to clipboard.");
  }
}
</script>

<template>
  <SettingsPage
    title="Network"
    description="Local address and port for this terminal."
  >
    <SettingsSection title="Local address" description="Configure the hostname and port for the local server.">
      <Card class="flex flex-col gap-2 p-4">
        <div
          v-if="pendingRestart"
          class="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-900 dark:text-amber-100"
        >
          Restart <code class="text-xs">workbench-cli</code> (or <code class="text-xs">npm run dev</code>) to apply host or port changes.
        </div>

        <Item variant="outline">
          <ItemContent>
            <ItemTitle>Current URL</ItemTitle>
          </ItemContent>
          <ItemActions>
            <span class="font-mono text-xs text-muted-foreground">{{ localUrl || 'Loading…' }}</span>
          </ItemActions>
        </Item>

        <Item variant="outline">
          <ItemContent>
            <ItemTitle>Hostname</ItemTitle>
            <ItemDescription>
              Friendly name for this machine. Add the hosts line below once if the browser cannot resolve it.
            </ItemDescription>
          </ItemContent>
          <ItemActions>
            <Input
              v-model="hostInput"
              class="w-48 font-mono text-sm"
              :disabled="loading"
              autocomplete="off"
              spellcheck="false"
            />
          </ItemActions>
        </Item>

        <Item variant="outline">
          <ItemContent>
            <ItemTitle>Port</ItemTitle>
            <ItemDescription>Avoid 3000 — many dev tools use it.</ItemDescription>
          </ItemContent>
          <ItemActions>
            <Input
              v-model="portInput"
              type="number"
              min="1"
              max="65535"
              class="w-28 font-mono text-sm"
              :disabled="loading"
            />
          </ItemActions>
        </Item>

        <Item v-if="hostsFileLine" variant="outline">
          <ItemContent>
            <ItemTitle>/etc/hosts</ItemTitle>
            <ItemDescription>One-time setup so your browser can open the hostname.</ItemDescription>
          </ItemContent>
          <ItemActions>
            <div class="flex items-center gap-2">
              <code class="truncate rounded bg-muted px-2 py-1 text-xs">{{ hostsFileLine }}</code>
              <Button variant="outline" size="sm" :disabled="loading" @click="copyHostsLine">
                Copy
              </Button>
            </div>
          </ItemActions>
        </Item>

        <div v-if="setupPrompt" class="space-y-2 px-1">
          <p class="text-xs text-muted-foreground">
            Or copy the prompt below and paste it into your agent to set up the hosts entry for you.
          </p>
          <div class="relative">
            <Button
              type="button"
              class="top-2 right-3 absolute"
              variant="outline"
              size="xs"
              :disabled="loading"
              @click="copySetupPrompt"
            >
              Copy prompt
            </Button>
            <Textarea
              readonly
              :model-value="setupPrompt"
              class="font-mono text-xs min-h-[120px] resize-none bg-muted pt-10 pr-28"
            />
          </div>
        </div>

        <div v-if="tlsSetupPrompt" class="space-y-2 px-1">
          <p class="text-xs text-muted-foreground">
            Serving over HTTP. Copy the prompt below and paste it into your agent to install mkcert and generate the PEM files for HTTPS.
          </p>
          <div class="relative">
            <Button
              type="button"
              class="top-2 right-3 absolute"
              variant="outline"
              size="xs"
              :disabled="loading"
              @click="copyTlsSetupPrompt"
            >
              Copy prompt
            </Button>
            <Textarea
              readonly
              :model-value="tlsSetupPrompt"
              class="font-mono text-xs min-h-[120px] resize-none bg-muted pt-10 pr-28"
            />
          </div>
        </div>

        <div class="flex justify-end pt-2">
          <Button :disabled="loading || !networkDirty" @click="saveNetwork">
            Save
          </Button>
        </div>
      </Card>
    </SettingsSection>
  </SettingsPage>
</template>
