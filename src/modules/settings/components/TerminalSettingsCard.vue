<script setup lang="ts">
import { computed, ref } from "vue";
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
import type { TerminalSettings } from "@server/schemas/api";
import SettingsPage from "@/modules/settings/components/SettingsPage.vue";
import SettingsSection from "@/modules/settings/components/SettingsSection.vue";
import SettingsRow from "@/modules/settings/components/SettingsRow.vue";
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
  <SettingsPage
    title="General"
    description="Session restore, agent resume, and scrollback limits for terminal tabs."
  >
    <div v-if="error" class="border-b border-destructive/30 bg-destructive/10 px-8 py-3 text-sm text-destructive">
      {{ error }}
    </div>

    <SettingsSection
      title="Agent sessions"
      description="When a supported CLI exits, store its session id and optionally resume on cold attach. Requires shell integration (OSC 133) in the terminal."
    >
      <SettingsRow
        label="Auto-resume on cold start"
        description="Spawn the agent resume command when reconnecting if a session was captured."
      >
        <Switch
          id="auto-resume"
          :checked="autoResume"
          :disabled="loading || !anyAgentHookEnabled"
          @update:checked="onAutoResumeChange"
        />
      </SettingsRow>

      <div class="flex flex-wrap items-center gap-2 py-4">
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

      <div class="overflow-x-auto py-2">
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
      </div>
    </SettingsSection>

    <SettingsSection
      title="PTY & scrollback"
      description="Keep processes alive across browser refresh and tune memory limits."
    >
      <SettingsRow
        label="Persist scrollback on shutdown"
        description="Best-effort replay when the server restarts and no live PTY exists."
      >
        <Switch
          id="scrollback-persist"
          :checked="scrollbackPersist"
          :disabled="loading"
          @update:checked="onScrollbackPersistChange"
        />
      </SettingsRow>

      <SettingsRow
        label="PTY idle TTL (hours)"
        description="Kill detached PTYs after this many hours with no clients."
      >
        <Input
          id="pty-idle-ttl"
          type="number"
          min="1"
          class="w-24"
          :model-value="ptyIdleTtlHours"
          :disabled="loading"
          @blur="onPtyIdleBlur"
        />
      </SettingsRow>

      <SettingsRow
        label="Scrollback cap (KB)"
        description="In-memory ring buffer size per terminal."
      >
        <Input
          id="scrollback-cap"
          type="number"
          min="64"
          class="w-24"
          :model-value="scrollbackCapKb"
          :disabled="loading"
          @blur="onScrollbackCapBlur"
        />
      </SettingsRow>
    </SettingsSection>

    <SettingsSection
      title="Custom restart commands"
      description="Approved prefixes for per-tab restart commands (right-click a tab → Set restart command). Takes priority over agent auto-resume when trusted."
    >
      <div class="grid gap-4 py-4 sm:grid-cols-[1fr_12rem_auto] sm:items-end">
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

      <div v-if="approvedPrefixes.length > 0" class="overflow-x-auto py-2">
        <Table>
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
      </div>
      <p v-else class="py-4 text-sm text-muted-foreground">No approved prefixes yet.</p>
    </SettingsSection>
  </SettingsPage>
</template>
