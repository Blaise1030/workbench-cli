<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import LanShareCard from "@/modules/settings/components/LanShareCard.vue";
import SettingsPage from "@/modules/settings/components/SettingsPage.vue";
import SettingsSection from "@/modules/settings/components/SettingsSection.vue";
import SettingsRow from "@/modules/settings/components/SettingsRow.vue";
import {
  useLanSettingsQuery,
  useNetworkSettingsQuery,
  usePatchNetworkSettingsMutation,
  useRefreshInviteMutation,
  useSetLanMutation,
} from "@/modules/settings/queries/settings";
import { ApiError } from "@/lib/api-error";

const { data: lanData, isPending: lanPending } = useLanSettingsQuery();
const { data: networkData, isPending: networkPending } = useNetworkSettingsQuery();
const setLan = useSetLanMutation();
const refreshInvite = useRefreshInviteMutation();
const patchNetwork = usePatchNetworkSettingsMutation();

const enabled = computed(() => lanData.value?.enabled ?? false);
const lanUrl = computed(() => lanData.value?.lanUrl);
const inviteExpiresAt = computed(() => lanData.value?.inviteExpiresAt);

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
const confirmEnable = ref(false);
const confirmDisable = ref(false);
const pendingEnable = ref<boolean | null>(null);

const loading = computed(
  () =>
    lanPending.value ||
    networkPending.value ||
    setLan.isPending.value ||
    refreshInvite.isPending.value ||
    patchNetwork.isPending.value,
);

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

async function applyLan(next: boolean): Promise<void> {
  error.value = "";
  try {
    await setLan.mutateAsync(next);
  } catch (err) {
    error.value = mutationErrorMessage(err, "Failed to update LAN settings.");
  }
}

function onSwitchChange(checked: boolean) {
  if (loading.value) return;
  pendingEnable.value = checked;
  if (checked) {
    confirmEnable.value = true;
  } else {
    confirmDisable.value = true;
  }
}

async function confirmEnableAction() {
  confirmEnable.value = false;
  if (pendingEnable.value !== true) return;
  await applyLan(true);
  pendingEnable.value = null;
}

function cancelEnable() {
  confirmEnable.value = false;
  pendingEnable.value = null;
}

async function confirmDisableAction() {
  confirmDisable.value = false;
  if (pendingEnable.value !== false) return;
  await applyLan(false);
  pendingEnable.value = null;
}

function cancelDisable() {
  confirmDisable.value = false;
  pendingEnable.value = null;
}

async function onRefreshInvite() {
  error.value = "";
  try {
    await refreshInvite.mutateAsync();
  } catch (err) {
    error.value = mutationErrorMessage(err, "Failed to regenerate link.");
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
    description="Local address, port, and who can reach this terminal on your Wi‑Fi."
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

    <SettingsSection title="LAN access">
      <SettingsRow
        label="Allow LAN access"
        description="Let other devices on your Wi‑Fi reach this terminal."
      >
        <Switch
          id="lan-switch"
          :checked="pendingEnable ?? enabled"
          :disabled="loading"
          @update:checked="onSwitchChange"
        />
      </SettingsRow>
    </SettingsSection>

    <LanShareCard
      v-if="enabled && lanUrl"
      :lan-url="lanUrl"
      :invite-expires-at="inviteExpiresAt"
      @refresh="onRefreshInvite"
    />

    <AlertDialog :open="confirmEnable" @update:open="(v) => !v && cancelEnable()">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Enable LAN access?</AlertDialogTitle>
          <AlertDialogDescription>
            Anyone on your Wi‑Fi can reach this terminal. They still need the invite link or access token to sign in.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel @click="cancelEnable">Cancel</AlertDialogCancel>
          <AlertDialogAction @click="confirmEnableAction">Continue</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    <AlertDialog :open="confirmDisable" @update:open="(v) => !v && cancelDisable()">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Stop LAN access?</AlertDialogTitle>
          <AlertDialogDescription>
            Other devices will no longer be able to connect. Your local session continues.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel @click="cancelDisable">Cancel</AlertDialogCancel>
          <AlertDialogAction @click="confirmDisableAction">Stop</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </SettingsPage>
</template>
