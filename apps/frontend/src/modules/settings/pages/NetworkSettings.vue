<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from "vue";
import QRCode from "qrcode";
import { toast } from "vue-sonner";
import { Input } from "@/components/ui/input";
import { useQueryClient } from "@tanstack/vue-query";
import { settingsKeys } from "@/modules/settings/queries/settings";
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

const lanMode = computed(() => networkData.value?.lanMode ?? false);
const lanUrls = computed(() => networkData.value?.lanUrls ?? []);
const lanIps = computed(() => networkData.value?.lanIps ?? []);
const inviteUrl = computed(() => networkData.value?.inviteUrl ?? "");
const primaryLanUrl = computed(() => lanUrls.value[0] ?? "");
const qrDataUrl = ref<string>("");

watch(
  inviteUrl,
  async (url) => {
    if (url) {
      try {
        // Use the invite URL (contains rotating single-use token) for the QR
        qrDataUrl.value = await QRCode.toDataURL(url, { margin: 1, width: 160 });
      } catch {
        qrDataUrl.value = "";
      }
    } else if (lanUrls.value.length > 0) {
      // fallback to plain LAN URL if no invite token
      try {
        qrDataUrl.value = await QRCode.toDataURL(lanUrls.value[0], { margin: 1, width: 160 });
      } catch {
        qrDataUrl.value = "";
      }
    } else {
      qrDataUrl.value = "";
    }
  },
  { immediate: true },
);

const hostInput = ref("");
const portInput = ref("");

const queryClient = useQueryClient();
let inviteRefresh: ReturnType<typeof setInterval> | undefined;

watch(
  lanMode,
  (active) => {
    if (inviteRefresh) {
      clearInterval(inviteRefresh);
      inviteRefresh = undefined;
    }
    if (active) {
      // Poll for fresh rotating invite token / QR (token changes every ~30s)
      inviteRefresh = setInterval(() => {
        queryClient.invalidateQueries({ queryKey: settingsKeys.network() });
      }, 7000);
    }
  },
  { immediate: true },
);

onUnmounted(() => {
  if (inviteRefresh) clearInterval(inviteRefresh);
});

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

async function copyLanUrl(url: string) {
  try {
    await navigator.clipboard.writeText(url);
    toast.success("Copied LAN URL to clipboard.");
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

        <div v-if="lanUrls.length" class="mt-3 border-t pt-3">
          <div class="mb-2">
            <div class="font-medium text-sm">LAN access</div>
            <div class="text-xs text-muted-foreground">
              Base LAN URLs. For secure access from other devices use the rotating invite link below (token changes every 30s and is single-use).
            </div>
          </div>

          <!-- Plain LAN URLs (for reference) -->
          <div class="flex flex-col gap-2 mb-3">
            <div v-for="u in lanUrls" :key="u" class="flex items-center gap-2">
              <code class="flex-1 truncate rounded bg-muted px-2 py-1 text-xs font-mono">{{ u }}</code>
              <Button variant="outline" size="sm" :disabled="loading" @click="copyLanUrl(u)">Copy</Button>
            </div>
          </div>

          <!-- Invite link + QR (recommended for phone) -->
          <div v-if="inviteUrl" class="space-y-2">
            <div class="text-xs font-medium">Invite link (rotates every 30s, single-use)</div>
            <div class="flex items-center gap-2">
              <code class="flex-1 truncate rounded bg-muted px-2 py-1 text-xs font-mono">{{ inviteUrl }}</code>
              <Button variant="outline" size="sm" :disabled="loading" @click="copyLanUrl(inviteUrl)">Copy</Button>
            </div>
            <div v-if="qrDataUrl" class="mt-2 flex items-start gap-3">
              <img :src="qrDataUrl" alt="Scan to open on another device" class="rounded border bg-white p-1" />
              <div class="text-[10px] text-muted-foreground pt-1 leading-tight">
                Scan with phone camera.<br />
                Token auto-invalidates after use or 30s.
              </div>
            </div>
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
