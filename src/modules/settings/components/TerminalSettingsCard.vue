<script setup lang="ts">
import { computed, ref } from "vue";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { TerminalSettings } from "@server/schemas/api";
import {
  useAddResumePrefixMutation,
  usePatchTerminalSettingsMutation,
  useRevokeResumePrefixMutation,
  useTerminalResumePrefixesQuery,
  useTerminalSettingsQuery,
} from "@/modules/settings/queries/settings";
import { ApiError } from "@/lib/api-error";

type AgentHookKind = keyof TerminalSettings["agentHooks"];

const AGENT_ROWS: {
  kind: AgentHookKind;
  label: string;
  binaries: string;
  resumeExample: string;
}[] = [
  {
    kind: "claude",
    label: "Claude Code",
    binaries: "claude",
    resumeExample: "claude --resume <session-id>",
  },
  {
    kind: "codex",
    label: "Codex",
    binaries: "codex",
    resumeExample: "codex resume <session-id>",
  },
  {
    kind: "cursor",
    label: "Cursor Agent",
    binaries: "agent, cursor-agent",
    resumeExample: "agent --resume <chat-id>",
  },
  {
    kind: "gemini",
    label: "Gemini CLI",
    binaries: "gemini",
    resumeExample: "gemini --resume <session-id>",
  },
];

const { data, isPending } = useTerminalSettingsQuery();
const { data: prefixesData, isPending: prefixesPending } = useTerminalResumePrefixesQuery();
const patchSettings = usePatchTerminalSettingsMutation();
const addPrefix = useAddResumePrefixMutation();
const revokePrefix = useRevokeResumePrefixMutation();

const error = ref("");
const newPrefix = ref("");
const newPrefixLabel = ref("");

const autoResume = computed(() => data.value?.autoResumeAgentSessions ?? true);
const scrollbackPersist = computed(() => data.value?.scrollbackPersistOnShutdown ?? true);
const ptyIdleTtlHours = computed(() => String(data.value?.ptyIdleTtlHours ?? 24));
const scrollbackCapKb = computed(() => String(data.value?.scrollbackCapKb ?? 4096));
const approvedPrefixes = computed(() => prefixesData.value?.approvedPrefixes ?? []);

const agentHooks = computed(() => data.value?.agentHooks ?? {
  claude: true,
  codex: true,
  cursor: true,
  gemini: true,
});

const anyAgentHookEnabled = computed(() =>
  AGENT_ROWS.some((row) => agentHooks.value[row.kind]),
);

const loading = computed(
  () =>
    isPending.value ||
    prefixesPending.value ||
    patchSettings.isPending.value ||
    addPrefix.isPending.value ||
    revokePrefix.isPending.value,
);

function mutationErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiError) return err.message;
  return fallback;
}

async function savePatch(patch: Partial<TerminalSettings>): Promise<void> {
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

function onAgentHookChange(kind: AgentHookKind, checked: boolean) {
  void savePatch({ agentHooks: { [kind]: checked } });
}

function enableAllAgentHooks() {
  void savePatch({
    agentHooks: { claude: true, codex: true, cursor: true, gemini: true },
  });
}

function disableAllAgentHooks() {
  void savePatch({
    agentHooks: { claude: false, codex: false, cursor: false, gemini: false },
  });
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

async function addApprovedPrefix() {
  const prefix = newPrefix.value.trim();
  if (!prefix) {
    error.value = "Enter a command prefix to approve.";
    return;
  }
  error.value = "";
  try {
    await addPrefix.mutateAsync({
      prefix,
      label: newPrefixLabel.value.trim() || undefined,
    });
    newPrefix.value = "";
    newPrefixLabel.value = "";
  } catch (err) {
    error.value = mutationErrorMessage(err, "Failed to add prefix.");
  }
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
        Session restore, agent resume, and scrollback limits for terminal tabs.
      </CardDescription>
    </CardHeader>
    <CardContent class="flex flex-col gap-6">
      <section class="space-y-4">
        <div>
          <h3 class="text-sm font-medium">Agent sessions</h3>
          <p class="text-sm text-muted-foreground">
            When a supported CLI exits, store its session id and optionally resume on cold attach.
            Requires shell integration (OSC 133) in the terminal.
          </p>
        </div>

        <div class="flex items-center justify-between gap-4">
          <div class="space-y-1">
            <Label for="auto-resume">Auto-resume on cold start</Label>
            <p class="text-sm text-muted-foreground">
              Spawn the agent resume command when reconnecting if a session was captured.
            </p>
          </div>
          <Switch
            id="auto-resume"
            :checked="autoResume"
            :disabled="loading || !anyAgentHookEnabled"
            @update:checked="onAutoResumeChange"
          />
        </div>

        <div class="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            :disabled="loading"
            @click="enableAllAgentHooks"
          >
            Enable all agents
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            :disabled="loading"
            @click="disableAllAgentHooks"
          >
            Disable all agents
          </Button>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Agent</TableHead>
              <TableHead>Detect</TableHead>
              <TableHead>Cold-start command</TableHead>
              <TableHead class="w-[88px] text-right">Capture</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-for="row in AGENT_ROWS" :key="row.kind">
              <TableCell class="font-medium">{{ row.label }}</TableCell>
              <TableCell>
                <code class="text-xs">{{ row.binaries }}</code>
              </TableCell>
              <TableCell>
                <code class="text-xs">{{ row.resumeExample }}</code>
              </TableCell>
              <TableCell class="text-right">
                <Switch
                  :id="`${row.kind}-hook`"
                  :checked="agentHooks[row.kind]"
                  :disabled="loading"
                  @update:checked="(checked) => onAgentHookChange(row.kind, checked)"
                />
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </section>

      <Separator />

      <section class="space-y-4">
        <div>
          <h3 class="text-sm font-medium">PTY &amp; scrollback</h3>
          <p class="text-sm text-muted-foreground">
            Keep processes alive across browser refresh and tune memory limits.
          </p>
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
      </section>

      <Separator />

      <section class="space-y-4">
        <div>
          <h3 class="text-sm font-medium">Custom restart commands</h3>
          <p class="text-sm text-muted-foreground">
            Approved prefixes for per-tab restart commands (right-click a tab → Set restart command).
            Takes priority over agent auto-resume when trusted.
          </p>
        </div>

        <div class="grid gap-3 sm:grid-cols-[1fr_12rem_auto] sm:items-end">
          <div class="space-y-2">
            <Label for="new-prefix">Command prefix</Label>
            <Input
              id="new-prefix"
              v-model="newPrefix"
              placeholder="tmux attach -t mysession"
              :disabled="loading"
              @keydown.enter="addApprovedPrefix"
            />
          </div>
          <div class="space-y-2">
            <Label for="new-prefix-label">Label (optional)</Label>
            <Input
              id="new-prefix-label"
              v-model="newPrefixLabel"
              placeholder="work tmux"
              :disabled="loading"
              @keydown.enter="addApprovedPrefix"
            />
          </div>
          <Button type="button" :disabled="loading" @click="addApprovedPrefix">Add</Button>
        </div>

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
      </section>

      <p v-if="error" class="text-sm text-destructive">{{ error }}</p>
    </CardContent>
  </Card>
</template>
