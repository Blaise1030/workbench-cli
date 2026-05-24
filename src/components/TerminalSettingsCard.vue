<script setup lang="ts">
import { computed, ref } from "vue";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  usePatchTerminalSettingsMutation,
  useRevokeResumePrefixMutation,
  useTerminalResumePrefixesQuery,
  useTerminalSettingsQuery,
} from "@/api/settings";
import { ApiError } from "@/lib/api-error";

const { data, isPending } = useTerminalSettingsQuery();
const { data: prefixesData, isPending: prefixesPending } = useTerminalResumePrefixesQuery();
const patchSettings = usePatchTerminalSettingsMutation();
const revokePrefix = useRevokeResumePrefixMutation();

const error = ref("");

const autoResume = computed(() => data.value?.autoResumeAgentSessions ?? true);
const scrollbackPersist = computed(() => data.value?.scrollbackPersistOnShutdown ?? true);
const ptyIdleTtlHours = computed(() => String(data.value?.ptyIdleTtlHours ?? 24));
const scrollbackCapKb = computed(() => String(data.value?.scrollbackCapKb ?? 4096));
const claudeHookEnabled = computed(() => data.value?.agentHooks?.claude ?? true);
const codexHookEnabled = computed(() => data.value?.agentHooks?.codex ?? true);

const loading = computed(
  () =>
    isPending.value ||
    prefixesPending.value ||
    patchSettings.isPending.value ||
    revokePrefix.isPending.value,
);

function mutationErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiError) return err.message;
  return fallback;
}

async function savePatch(patch: {
  autoResumeAgentSessions?: boolean;
  scrollbackPersistOnShutdown?: boolean;
  ptyIdleTtlHours?: number;
  scrollbackCapKb?: number;
  agentHooks?: { claude?: boolean; codex?: boolean };
}): Promise<void> {
  error.value = "";
  try {
    await patchSettings.mutateAsync(patch);
  } catch (err) {
    error.value = mutationErrorMessage(err, "Failed to update terminal settings.");
  }
}

function onAutoResumeChange(checked: boolean) {
  void savePatch({ autoResumeAgentSessions: checked });
}

function onClaudeHookChange(checked: boolean) {
  void savePatch({ agentHooks: { claude: checked } });
}

function onCodexHookChange(checked: boolean) {
  void savePatch({ agentHooks: { codex: checked } });
}

function onScrollbackPersistChange(checked: boolean) {
  void savePatch({ scrollbackPersistOnShutdown: checked });
}

function onPtyIdleBlur(event: Event) {
  const raw = (event.target as HTMLInputElement).value;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1) return;
  if (n === data.value?.ptyIdleTtlHours) return;
  void savePatch({ ptyIdleTtlHours: n });
}

function onScrollbackCapBlur(event: Event) {
  const raw = (event.target as HTMLInputElement).value;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 64) return;
  if (n === data.value?.scrollbackCapKb) return;
  void savePatch({ scrollbackCapKb: n });
}

async function revoke(id: string) {
  error.value = "";
  try {
    await revokePrefix.mutateAsync(id);
  } catch (err) {
    error.value = mutationErrorMessage(err, "Failed to revoke prefix.");
  }
}
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle>Terminal</CardTitle>
      <CardDescription>
        Session restore: keep PTYs alive across reconnects and tune scrollback limits.
      </CardDescription>
    </CardHeader>
    <CardContent class="flex flex-col gap-6">
      <div class="flex items-center justify-between gap-4">
        <div class="space-y-1">
          <Label for="auto-resume">Resume agent sessions</Label>
          <p class="text-sm text-muted-foreground">
            On cold start, run <code class="text-xs">claude --resume</code> or
            <code class="text-xs">codex resume</code> when a session was captured.
          </p>
        </div>
        <Switch
          id="auto-resume"
          :checked="autoResume"
          :disabled="loading"
          @update:checked="onAutoResumeChange"
        />
      </div>

      <div class="flex items-center justify-between gap-4">
        <div class="space-y-1">
          <Label for="claude-hook">Capture Claude Code sessions</Label>
          <p class="text-sm text-muted-foreground">
            Detect <code class="text-xs">claude</code> runs and store the latest session id.
          </p>
        </div>
        <Switch
          id="claude-hook"
          :checked="claudeHookEnabled"
          :disabled="loading"
          @update:checked="onClaudeHookChange"
        />
      </div>

      <div class="flex items-center justify-between gap-4">
        <div class="space-y-1">
          <Label for="codex-hook">Capture Codex sessions</Label>
          <p class="text-sm text-muted-foreground">
            Detect <code class="text-xs">codex</code> runs and store the latest session id.
          </p>
        </div>
        <Switch
          id="codex-hook"
          :checked="codexHookEnabled"
          :disabled="loading"
          @update:checked="onCodexHookChange"
        />
      </div>

      <div class="flex items-center justify-between gap-4">
        <div class="space-y-1">
          <Label for="scrollback-persist">Persist scrollback on shutdown</Label>
          <p class="text-sm text-muted-foreground">
            Best-effort replay when the server restarts and no live PTY exists.
          </p>
        </div>
        <Switch
          id="scrollback-persist"
          :checked="scrollbackPersist"
          :disabled="loading"
          @update:checked="onScrollbackPersistChange"
        />
      </div>

      <div class="grid gap-4 sm:grid-cols-2">
        <div class="space-y-2">
          <Label for="pty-idle-ttl">PTY idle TTL (hours)</Label>
          <Input
            id="pty-idle-ttl"
            type="number"
            min="1"
            :model-value="ptyIdleTtlHours"
            :disabled="loading"
            @blur="onPtyIdleBlur"
          />
          <p class="text-sm text-muted-foreground">
            Kill detached PTYs after this many hours with no clients.
          </p>
        </div>
        <div class="space-y-2">
          <Label for="scrollback-cap">Scrollback cap (KB)</Label>
          <Input
            id="scrollback-cap"
            type="number"
            min="64"
            :model-value="scrollbackCapKb"
            :disabled="loading"
            @blur="onScrollbackCapBlur"
          />
          <p class="text-sm text-muted-foreground">In-memory ring buffer size per terminal.</p>
        </div>
      </div>

      <div class="space-y-2">
        <Label>Approved resume command prefixes</Label>
        <p class="text-sm text-muted-foreground">
          Trusted command prefixes for custom terminal restart (Slice C).
        </p>
        <Table v-if="approvedPrefixes.length > 0">
          <TableHeader>
            <TableRow>
              <TableHead>Prefix</TableHead>
              <TableHead>Label</TableHead>
              <TableHead class="w-[100px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-for="item in approvedPrefixes" :key="item.id">
              <TableCell>
                <code class="text-xs">{{ item.prefix }}</code>
              </TableCell>
              <TableCell class="text-sm text-muted-foreground">
                {{ item.label ?? "—" }}
              </TableCell>
              <TableCell>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  :disabled="loading"
                  @click="revoke(item.id)"
                >
                  Revoke
                </Button>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
        <p v-else class="text-sm text-muted-foreground">No approved prefixes yet.</p>
      </div>

      <p v-if="error" class="text-sm text-destructive">{{ error }}</p>
    </CardContent>
  </Card>
</template>
