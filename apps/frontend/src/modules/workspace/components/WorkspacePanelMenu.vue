<script setup lang="ts">
import { computed, ref } from "vue";
import { BotIcon, ChevronDownIcon, PlusIcon, TerminalIcon } from "@lucide/vue";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useAgentsQuery } from "@/modules/settings/queries";
import AgentBuiltinIcon from "@/modules/settings/components/AgentBuiltinIcon.vue";
import type { WorkbenchAgent } from "@/modules/settings/types/agents";
import type { AddTerminalChoice } from "@/modules/workspace/types/add-terminal-choice";

const INLINE_BUILTIN_IDS = new Set(["claude", "codex", "cursor", "gemini"]);

const emit = defineEmits<{
  add: [choice: AddTerminalChoice];
}>();

const open = ref(false);

const { data: agentsData } = useAgentsQuery();

const agents = computed(() => agentsData.value?.agents ?? []);

function pick(choice: AddTerminalChoice) {
  open.value = false;
  emit("add", choice);
}

const menuItemClass =
  "flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-sm outline-none hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:text-accent-foreground";

function agentIconSrc(agent: WorkbenchAgent) {
  return agent.icon?.trim() || undefined;
}
</script>

<template>
  <Popover v-model:open="open">
    <PopoverTrigger as-child>
      <Button
        type="button"
        variant="ghost"
        class="h-6 shrink-0 gap-0 px-1.5 text-muted-foreground hover:text-foreground"
        aria-label="Add terminal"
        title="Add terminal"
        :aria-expanded="open"
      >
        <PlusIcon class="size-3.5 shrink-0" />
        <ChevronDownIcon class="size-2.5 shrink-0 opacity-70" />
      </Button>
    </PopoverTrigger>
    <PopoverContent align="end" side="bottom" class="w-48 gap-0 p-1">
      <button type="button" :class="menuItemClass" @click="pick({ kind: 'shell' })">
        <TerminalIcon class="size-4 shrink-0 opacity-70" />
        Terminal
      </button>
      <template v-if="agents.length > 0">
        <div class="my-0.5 h-px bg-border" role="separator" />
        <button
          v-for="agent in agents"
          :key="agent.id"
          type="button"
          :class="menuItemClass"
          @click="pick({ kind: 'agent', agent })"
        >
          <AgentBuiltinIcon
            v-if="INLINE_BUILTIN_IDS.has(agent.id)"
            :agent-id="agent.id"
            extra-class="size-4"
          />
          <img
            v-else-if="agentIconSrc(agent)"
            :src="agentIconSrc(agent)"
            :alt="agent.name"
            class="size-4 shrink-0 rounded object-cover"
          />
          <BotIcon v-else class="size-4 shrink-0 opacity-70" />
          <span class="min-w-0 truncate">{{ agent.name }}</span>
        </button>
      </template>
    </PopoverContent>
  </Popover>
</template>
