<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { PlusIcon, Trash2Icon } from "@lucide/vue";
import AgentAvatar from "@/modules/settings/components/AgentAvatar.vue";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
} from "@/components/ui/item";
import { Card } from "@/components/ui/card";
import SettingsPage from "@/modules/settings/components/SettingsPage.vue";
import SettingsSection from "@/modules/settings/components/SettingsSection.vue";
import SettingsRow from "@/modules/settings/components/SettingsRow.vue";
import {
  useAgentsQuery,
  useApplyAgentHooksMutation,
  useCreateAgentMutation,
  useDeleteAgentMutation,
  usePatchAgentsMutation,
} from "@/modules/settings/queries/agents";
import type { PatchWorkbenchAgent } from "@/modules/settings/types/agents";
import { ApiError } from "@/lib/api-error";

const { data, isPending } = useAgentsQuery();
const patch = usePatchAgentsMutation();
const createAgent = useCreateAgentMutation();
const deleteAgent = useDeleteAgentMutation();
const applyHooks = useApplyAgentHooksMutation();

const error = ref("");
const success = ref("");
const openAccordion = ref<string>("claude");

const addDialogOpen = ref(false);
const dialogError = ref("");
const newName = ref("");
const newStart = ref("");
const newResume = ref("");

const loading = computed(
  () =>
    isPending.value ||
    patch.isPending.value ||
    createAgent.isPending.value ||
    deleteAgent.isPending.value ||
    applyHooks.isPending.value,
);

const canSubmitNewAgent = computed(
  () =>
    Boolean(newName.value.trim()) &&
    Boolean(newStart.value.trim()) &&
    Boolean(newResume.value.trim()),
);

watch(addDialogOpen, (open) => {
  if (!open) {
    dialogError.value = "";
    newName.value = "";
    newStart.value = "";
    newResume.value = "";
  }
});

function mutationErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error) return err.message;
  return fallback;
}

async function saveAgent(id: string, partial: PatchWorkbenchAgent) {
  error.value = "";
  success.value = "";
  try {
    await patch.mutateAsync({ [id]: partial });
  } catch (err) {
    error.value = mutationErrorMessage(err, "Failed to save agent.");
  }
}

function onHooksEnabledChange(id: string, enabled: boolean) {
  void saveAgent(id, { hooks: { enabled } });
}

function onFieldBlur(
  id: string,
  field: "name" | "startCommand" | "resumeCommand",
  event: Event,
) {
  const value = (event.target as HTMLInputElement).value.trim();
  const agent = data.value?.agents.find((a) => a.id === id);
  if (!agent || agent[field] === value) return;
  void saveAgent(id, { [field]: value });
}

function onHookTextBlur(id: string, field: "title" | "body", event: Event) {
  const value = (event.target as HTMLInputElement).value.trim();
  const agent = data.value?.agents.find((a) => a.id === id);
  if (!agent || agent.hooks[field] === value) return;
  void saveAgent(id, { hooks: { [field]: value } });
}

async function copyManifest(id: string) {
  const text = data.value?.manifests[id]?.settingsMerge;
  if (!text) return;
  error.value = "";
  try {
    await navigator.clipboard.writeText(text);
    success.value = "Copied hook config to clipboard.";
  } catch {
    error.value = "Could not copy to clipboard.";
  }
}

async function applyToAgent(id: string) {
  error.value = "";
  success.value = "";
  try {
    const result = await applyHooks.mutateAsync(id);
    success.value = `Wrote hooks to ${result.configPath} (backup: ${result.backupPath}).`;
  } catch (err) {
    error.value = mutationErrorMessage(err, "Failed to apply hooks.");
  }
}

async function addAgent() {
  dialogError.value = "";
  error.value = "";
  success.value = "";
  try {
    const created = await createAgent.mutateAsync({
      name: newName.value.trim(),
      startCommand: newStart.value.trim(),
      resumeCommand: newResume.value.trim(),
    });
    addDialogOpen.value = false;
    openAccordion.value = created.agent.id;
    success.value = "Agent added.";
  } catch (err) {
    dialogError.value = mutationErrorMessage(err, "Failed to add agent.");
  }
}

async function removeAgent(id: string) {
  error.value = "";
  success.value = "";
  try {
    await deleteAgent.mutateAsync(id);
    if (openAccordion.value === id) {
      openAccordion.value = data.value?.agents[0]?.id ?? "";
    }
    success.value = "Agent removed.";
  } catch (err) {
    error.value = mutationErrorMessage(err, "Failed to remove agent.");
  }
}
</script>

<template>
  <SettingsPage
    title="Agents"
    description="Configure coding agents: start and resume commands, and hooks that call workbench-cli to register sessions and send notifications. Saved to ~/.workbench/agents.json."
  >
    <SettingsSection
      title="Configured agents"
      description="Expand an agent to edit commands and notify hooks."
    >
      <p v-if="error" class="text-sm text-destructive">{{ error }}</p>
      <p v-if="success" class="text-sm text-muted-foreground">{{ success }}</p>

      <Card class="px-4 py-0 gap-0">
        <Accordion
          v-model="openAccordion"
          type="single"
          collapsible
          class="w-full"
        >
          <AccordionItem
            v-for="agent in data?.agents ?? []"
            :key="agent.id"
            :value="agent.id"
            class="border-b border-border px-0 last:border-b-0"
          >
          <AccordionTrigger class="px-0 hover:no-underline">
            <div class="flex w-full min-w-0 items-start gap-3 pr-2 text-left">
              <AgentAvatar
                :agent-id="agent.id"
                :name="agent.name"
                :icon="agent.icon"
                class="mt-0.5"
              />
              <div class="min-w-0 flex-1">
                <p class="font-medium leading-snug">{{ agent.name }}</p>
                <p class="truncate text-xs font-normal text-muted-foreground">
                  <span v-if="agent.builtin">Built-in</span>
                  <span v-else>Custom</span>
                  · <code class="text-[11px]">{{ agent.startCommand }}</code>
                  <span v-if="agent.hooks.enabled" class="ml-1.5 text-foreground/70">
                    · hooks on
                  </span>
                </p>
              </div>
              <Button
                v-if="!agent.builtin"
                type="button"
                variant="ghost"
                size="icon"
                class="size-8 shrink-0"
                :disabled="loading"
                aria-label="Remove agent"
                @click.stop="removeAgent(agent.id)"
              >
                <Trash2Icon class="size-4" />
              </Button>
            </div>
          </AccordionTrigger>

          <AccordionContent class="pb-6 pt-2">
            <div class="space-y-6">
              <div class="grid gap-4 sm:grid-cols-2">
                <div class="space-y-2 sm:col-span-2">
                  <Label :for="`${agent.id}-name`">Name</Label>
                  <Input
                    :id="`${agent.id}-name`"
                    data-native-keyboard
                    :model-value="agent.name"
                    :disabled="loading"
                    @blur="(e) => onFieldBlur(agent.id, 'name', e)"
                  />
                </div>
                <div class="space-y-2">
                  <Label :for="`${agent.id}-start`">Start command</Label>
                  <Input
                    :id="`${agent.id}-start`"
                    data-native-keyboard
                    :model-value="agent.startCommand"
                    :disabled="loading"
                    @blur="(e) => onFieldBlur(agent.id, 'startCommand', e)"
                  />
                </div>
                <div class="space-y-2">
                  <Label :for="`${agent.id}-resume`">Session resume command</Label>
                  <Input
                    :id="`${agent.id}-resume`"
                    data-native-keyboard
                    :model-value="agent.resumeCommand"
                    placeholder="e.g. claude --resume {{sessionId}}"
                    :disabled="loading"
                    @blur="(e) => onFieldBlur(agent.id, 'resumeCommand', e)"
                  />
                  <p class="text-xs text-muted-foreground">
                    Use <code v-pre>{{sessionId}}</code> where the session id belongs.
                  </p>
                </div>
              </div>

              <div class="space-y-3">
                <Item variant="outline">
                  <ItemContent>
                    <ItemTitle>Agent hooks</ItemTitle>
                    <ItemDescription>
                      When enabled, hooks call <code>workbench-cli register</code> to track
                      session state (<span class="text-green-600 dark:text-green-400">Running</span> /
                      <span class="text-orange-600 dark:text-orange-400">Needs Attention</span> /
                      Idle) and <code>workbench-cli notify</code> to send desktop notifications.
                      Use <b>Sync config</b> to write hooks to the agent's config file.
                    </ItemDescription>
                  </ItemContent>
                  <ItemActions>
                    <Label
                      :for="`${agent.id}-hooks-enabled`"
                      class="text-sm text-muted-foreground"
                    >
                      Enabled
                    </Label>
                    <Switch
                      :id="`${agent.id}-hooks-enabled`"
                      :checked="agent.hooks.enabled"
                      :disabled="loading"
                      @update:checked="(checked) => onHooksEnabledChange(agent.id, checked)"
                    />
                  </ItemActions>
                </Item>

                <div v-if="agent.hooks.enabled" class="space-y-4">
                  <div class="space-y-2">
                    <p class="text-sm font-medium">Hooks</p>
                    <ItemGroup class="flex flex-col gap-1.5">
                      <Item
                        v-for="ev in data?.meta[agent.id]?.supportedEvents ?? []"
                        :key="ev.id"
                        variant="outline"
                        size="sm"
                      >
                        <ItemContent>
                          <div class="flex items-center gap-2">
                            <ItemTitle>{{ ev.label }}</ItemTitle>
                            <span
                              v-if="ev.state"
                              :class="[
                                'rounded px-1.5 py-0.5 text-[10px] font-medium leading-none',
                                ev.state === 'running' && 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400',
                                ev.state === 'needs_attention' && 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400',
                                ev.state === 'idle' && 'bg-muted text-muted-foreground',
                              ]"
                            >
                              {{ ev.state === 'needs_attention' ? 'Needs Attention' : ev.state === 'running' ? 'Running' : 'Idle' }}
                            </span>
                            <span
                              v-else
                              class="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium leading-none text-muted-foreground"
                            >
                              notify
                            </span>
                          </div>
                          <ItemDescription>{{ ev.description }}</ItemDescription>
                        </ItemContent>
                      </Item>
                    </ItemGroup>
                  </div>

                  <div class="grid gap-3 sm:grid-cols-2">
                    <div class="space-y-2">
                      <Label :for="`${agent.id}-hook-title`">Notification title</Label>
                      <Input
                        :id="`${agent.id}-hook-title`"
                        data-native-keyboard
                        :model-value="agent.hooks.title"
                        :disabled="loading"
                        @blur="(e) => onHookTextBlur(agent.id, 'title', e)"
                      />
                    </div>
                    <div class="space-y-2">
                      <Label :for="`${agent.id}-hook-body`">Notification body</Label>
                      <Input
                        :id="`${agent.id}-hook-body`"
                        data-native-keyboard
                        :model-value="agent.hooks.body"
                        :disabled="loading"
                        @blur="(e) => onHookTextBlur(agent.id, 'body', e)"
                      />
                    </div>
                  </div>

                  <div v-if="agent.configPath" class="text-xs text-muted-foreground">
                    Config: <code>{{ agent.configPath }}</code>
                  </div>

                  <div class="flex flex-wrap gap-2">
                    <Button
                      v-if="agent.canApplyHooks"
                      type="button"
                      size="sm"
                      :disabled="loading"
                      @click="applyToAgent(agent.id)"
                    >
                      Sync config
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      :disabled="loading"
                      @click="copyManifest(agent.id)"
                    >
                      Copy JSON
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </AccordionContent>
          </AccordionItem>
        </Accordion>

        <div class="border-t border-border py-3">
          <Dialog v-model:open="addDialogOpen">
            <DialogTrigger as-child>
              <Button
                type="button"
                variant="outline"
                size="sm"
                :disabled="loading"
              >
                <PlusIcon class="size-4" />
                Add agent
              </Button>
            </DialogTrigger>
            <DialogContent class="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Add agent</DialogTitle>
                <DialogDescription>
                  Custom agents are matched by the first token of the start command.
                </DialogDescription>
              </DialogHeader>
              <form class="grid gap-4" @submit.prevent="addAgent">
                <div class="space-y-2">
                  <Label for="new-agent-name">Name</Label>
                  <Input
                    id="new-agent-name"
                    v-model="newName"
                    data-native-keyboard
                    placeholder="My Agent"
                    :disabled="loading"
                  />
                </div>
                <div class="space-y-2">
                  <Label for="new-agent-start">Start command</Label>
                  <Input
                    id="new-agent-start"
                    v-model="newStart"
                    data-native-keyboard
                    placeholder="my-agent"
                    :disabled="loading"
                  />
                </div>
                <div class="space-y-2">
                  <Label for="new-agent-resume">Resume command</Label>
                  <Input
                    id="new-agent-resume"
                    v-model="newResume"
                    data-native-keyboard
                    placeholder="my-agent --resume {{sessionId}}"
                    :disabled="loading"
                  />
                  <p class="text-xs text-muted-foreground">
                    Use <code v-pre>{{sessionId}}</code> where the session id belongs.
                  </p>
                </div>
                <p v-if="dialogError" class="text-sm text-destructive">{{ dialogError }}</p>
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    :disabled="loading"
                    @click="addDialogOpen = false"
                  >
                    Cancel
                  </Button>
                  <Button type="submit" :disabled="loading || !canSubmitNewAgent">
                    Add agent
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </Card>
    </SettingsSection>
  </SettingsPage>
</template>
