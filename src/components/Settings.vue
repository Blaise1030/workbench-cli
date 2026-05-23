<script setup lang="ts">
import { onMounted, ref } from "vue";
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

interface LanState {
  enabled: boolean;
  lanUrl?: string;
  inviteExpiresAt?: number;
}

const enabled = ref(false);
const lanUrl = ref<string | undefined>();
const inviteExpiresAt = ref<number | undefined>();
const loading = ref(false);
const error = ref("");
const confirmEnable = ref(false);
const confirmDisable = ref(false);
const pendingEnable = ref<boolean | null>(null);

async function fetchState(): Promise<void> {
  const res = await fetch("/api/settings/lan", { credentials: "include" });
  if (!res.ok) return;
  const body = (await res.json()) as LanState;
  enabled.value = body.enabled;
  lanUrl.value = body.lanUrl;
  inviteExpiresAt.value = body.inviteExpiresAt;
}

async function setLan(next: boolean): Promise<void> {
  error.value = "";
  loading.value = true;
  try {
    const res = await fetch("/api/settings/lan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ enabled: next }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      error.value = body.error ?? "Failed to update LAN settings.";
      await fetchState();
      return;
    }
    enabled.value = body.enabled;
    lanUrl.value = body.lanUrl;
    inviteExpiresAt.value = body.inviteExpiresAt;
  } catch {
    error.value = "Could not reach server.";
    await fetchState();
  } finally {
    loading.value = false;
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
  await setLan(true);
  pendingEnable.value = null;
}

function cancelEnable() {
  confirmEnable.value = false;
  pendingEnable.value = null;
  enabled.value = false;
}

async function confirmDisableAction() {
  confirmDisable.value = false;
  if (pendingEnable.value !== false) return;
  await setLan(false);
  pendingEnable.value = null;
}

function cancelDisable() {
  confirmDisable.value = false;
  pendingEnable.value = null;
  enabled.value = true;
}

async function refreshInvite() {
  loading.value = true;
  error.value = "";
  try {
    const res = await fetch("/api/settings/lan/refresh-invite", {
      method: "POST",
      credentials: "include",
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      error.value = body.error ?? "Failed to regenerate link.";
      return;
    }
    lanUrl.value = body.lanUrl;
    inviteExpiresAt.value = body.inviteExpiresAt;
  } catch {
    error.value = "Could not reach server.";
  } finally {
    loading.value = false;
  }
}

onMounted(fetchState);
</script>

<template>
  <div class="flex flex-col gap-4">
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
          :checked="enabled"
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
      @refresh="refreshInvite"
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
