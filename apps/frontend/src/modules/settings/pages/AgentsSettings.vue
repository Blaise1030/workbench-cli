<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { PlusIcon, Trash2Icon } from "@lucide/vue";
import AgentAvatar from "@/modules/settings/components/AgentAvatar.vue";
import { Label } from "@/components/ui/label";
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
} from "@/components/ui/item";
import { Card } from "@/components/ui/card";
import SettingsPage from "@/modules/settings/components/SettingsPage.vue";
import SettingsSection from "@/modules/settings/components/SettingsSection.vue";
import SettingsRow from "@/modules/settings/components/SettingsRow.vue";
import {
  useAgentsQuery,
  useCreateAgentMutation,
  useDeleteAgentMutation,
  usePatchAgentsMutation,
} from "@/modules/settings/queries/agents";
import type { PatchWorkbenchAgent } from "@/modules/settings/types/agents";
import { toast } from "vue-sonner";
import { ApiError } from "@/lib/api-error";

const { data, isPending } = useAgentsQuery();
const patch = usePatchAgentsMutation();
const createAgent = useCreateAgentMutation();
const deleteAgent = useDeleteAgentMutation();

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
    deleteAgent.isPending.value,
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
  try {
    await patch.mutateAsync({ [id]: partial });
  } catch (err) {
    toast.error(mutationErrorMessage(err, "Failed to save agent."));
  }
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

function buildPrompt(id: string): string {
  const manifest = data.value?.manifests[id];
  const agent = data.value?.agents.find((a) => a.id === id);
  if (!manifest?.settingsMerge) return "";
  const configPath = agent?.configPath ?? "the agent config file";
  const agentName = agent?.name ?? id;
  return [
    `Update the hooks configuration for ${agentName}.`,
    ``,
    `Merge the following JSON into \`${configPath}\`:`,
    ``,
    "```json",
    manifest.settingsMerge,
    "```",
    ``,
    manifest.installHint ?? `Save the file when done.`,
  ].join("\n");
}

async function copyPrompt(id: string) {
  const prompt = buildPrompt(id);
  if (!prompt) return;
  try {
    await navigator.clipboard.writeText(prompt);
    toast.success("Copied install prompt to clipboard.");
  } catch {
    toast.error("Could not copy to clipboard.");
  }
}

async function addAgent() {
  dialogError.value = "";
  try {
    const created = await createAgent.mutateAsync({
      name: newName.value.trim(),
      startCommand: newStart.value.trim(),
      resumeCommand: newResume.value.trim(),
    });
    addDialogOpen.value = false;
    openAccordion.value = created.agent.id;
    toast.success("Agent added.");
  } catch (err) {
    dialogError.value = mutationErrorMessage(err, "Failed to add agent.");
  }
}

async function removeAgent(id: string) {
  try {
    await deleteAgent.mutateAsync(id);
    if (openAccordion.value === id) {
      openAccordion.value = data.value?.agents[0]?.id ?? "";
    }
    toast.success("Agent removed.");
  } catch (err) {
    toast.error(mutationErrorMessage(err, "Failed to remove agent."));
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

              <div class="space-y-2">
                <div class="space-y-2">
                  <p class="text-xs text-muted-foreground">Copy the prompt below and paste it into your agent to enable hooks and session notifications.</p>

                  <div v-if="agent.configPath" class="text-xs text-muted-foreground">
                    Config: <code>{{ agent.configPath }}</code>
                  </div>

                  <div class="space-y-2 px-1 relative">
                    <Button
                      type="button"
                      class="top-2 right-3 absolute"
                      variant="outline"
                      size="xs"
                      :disabled="loading"
                      @click="copyPrompt(agent.id)"
                    >
                      Copy prompt
                    </Button>
                    <Textarea
                      readonly
                      :model-value="buildPrompt(agent.id)"
                      class="font-mono text-xs min-h-[180px] resize-none bg-muted"
                    />                    
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
