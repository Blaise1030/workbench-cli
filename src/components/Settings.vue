<script setup lang="ts">
import { computed, ref } from "vue";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
import LanShareCard from "@/components/LanShareCard.vue";
import TerminalSettingsCard from "@/components/TerminalSettingsCard.vue";
import {
  useLanSettingsQuery,
  useRefreshInviteMutation,
  useSetLanMutation,
} from "@/api/settings";
import { ApiError } from "@/lib/api-error";

const { data, isPending } = useLanSettingsQuery();
const setLan = useSetLanMutation();
const refreshInvite = useRefreshInviteMutation();

const enabled = computed(() => data.value?.enabled ?? false);
const lanUrl = computed(() => data.value?.lanUrl);
const inviteExpiresAt = computed(() => data.value?.inviteExpiresAt);

const error = ref("");
const confirmEnable = ref(false);
const confirmDisable = ref(false);
const pendingEnable = ref<boolean | null>(null);

const loading = computed(
  () =>
    isPending.value ||
    setLan.isPending.value ||
    refreshInvite.isPending.value,
);

function mutationErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiError) return err.message;
  return fallback;
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
</script>

<template>
  <div class="flex flex-col gap-4">
    <TerminalSettingsCard />

    <Card>
      <CardHeader>
        <CardTitle>Network</CardTitle>
        <CardDescription>Control who can reach this terminal on your local network.</CardDescription>
      </CardHeader>
      <CardContent class="flex items-center justify-between gap-4">
        <div class="space-y-1">
          <Label for="lan-switch">Allow LAN access</Label>
          <p class="text-sm text-muted-foreground">
            Let other devices on your Wi‑Fi reach this terminal.
          </p>
        </div>
        <Switch
          id="lan-switch"
          :checked="pendingEnable ?? enabled"
          :disabled="loading"
          @update:checked="onSwitchChange"
        />
      </CardContent>
    </Card>

    <p v-if="error" class="text-sm text-destructive">{{ error }}</p>

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
            Other devices will no longer be able to connect. Your localhost session continues.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel @click="cancelDisable">Cancel</AlertDialogCancel>
          <AlertDialogAction @click="confirmDisableAction">Stop</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>
</template>
