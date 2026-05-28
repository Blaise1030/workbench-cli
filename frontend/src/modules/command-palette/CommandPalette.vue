<script setup lang="ts">
import { computed, defineComponent, ref, watch } from "vue";
import { RouterLink } from "vue-router";
import { FileIcon, SearchIcon } from "@lucide/vue";
import { CommandDialog, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem, CommandSeparator, useCommand } from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon } from "@/components/ui/input-group";
import { closeCommandPalette } from "./useCommandPalette";
import { COMMANDS } from "./commands";
import { useFileSearch } from "./useFileSearch";

const CommandPaletteSearchBridge = defineComponent({
  props: {
    modelValue: { type: String, required: true },
  },
  emits: ["update:modelValue"],
  setup(props, { emit }) {
    const { filterState } = useCommand();

    watch(
      () => filterState.search,
      (search) => {
        if (props.modelValue.startsWith("@")) return;
        if (props.modelValue !== search) emit("update:modelValue", search);
      },
    );

    watch(
      () => props.modelValue,
      (value) => {
        if (value.startsWith("@")) {
          if (filterState.search) filterState.search = "";
          return;
        }
        if (filterState.search !== value) filterState.search = value;
      },
    );

    watch(
      () => props.modelValue.startsWith("@"),
      (fileMode) => {
        if (fileMode) filterState.search = "";
      },
    );

    return () => null;
  },
});

const props = defineProps<{
  open: boolean;
  worktreeId: string | undefined;
}>();

const emit = defineEmits<{
  "update:open": [value: boolean];
  action: [key: string];
}>();

const input = ref("");

const isFileMode = computed(() => input.value.startsWith("@"));
const fileQuery = computed(() => isFileMode.value ? input.value.slice(1) : "");
const commandQuery = computed(() => isFileMode.value ? "" : input.value);

const worktreeIdRef = computed(() => props.worktreeId);
const { results: fileResults, isLoading: fileLoading } = useFileSearch(worktreeIdRef, fileQuery);

const filteredCommands = computed(() => {
  const q = commandQuery.value.toLowerCase();
  return COMMANDS.filter((cmd) => {
    if (cmd.type === "navigate" && cmd.requiresWorktree && !props.worktreeId) return false;
    return !q || cmd.label.toLowerCase().includes(q);
  });
});

const navigateCommands = computed(() =>
  filteredCommands.value.filter((c) => c.type === "navigate"),
);
const actionCommands = computed(() =>
  filteredCommands.value.filter((c) => c.type === "action"),
);

function handleOpenChange(value: boolean) {
  if (!value) {
    input.value = "";
    closeCommandPalette();
  }
  emit("update:open", value);
}

function handleAction(key: string) {
  handleOpenChange(false);
  emit("action", key);
}

</script>

<template>
  <CommandDialog :open="open" @update:open="handleOpenChange">
    <template #default>
      <CommandPaletteSearchBridge v-model="input" />
      <CommandInput
        v-if="!isFileMode"
        placeholder="Type a command or @filename..."
      />
      <div v-else data-slot="command-input-wrapper" class="p-1 pb-0">
        <InputGroup class="bg-input/30 border-input/30 h-8! rounded-lg! shadow-none! *:data-[slot=input-group-addon]:pl-2!">
          <Input
            v-model="input"
            data-slot="command-input"
            auto-focus
            placeholder="Search files..."
            class="w-full border-0 bg-transparent text-sm shadow-none focus-visible:ring-0"
          />
          <InputGroupAddon>
            <SearchIcon class="size-4 shrink-0 opacity-50" />
          </InputGroupAddon>
        </InputGroup>
      </div>
      <CommandList>
        <!-- File search mode -->
        <template v-if="isFileMode">
          <CommandEmpty>
            <span v-if="!worktreeId">No active worktree</span>
            <span v-else-if="fileLoading">Searching...</span>
            <span v-else>No files found</span>
          </CommandEmpty>
          <CommandGroup v-if="fileResults.length" heading="Files">
            <CommandItem
              v-for="path in fileResults"
              :key="path"
              :value="path"
              as-child
            >
              <RouterLink
                :to="{ name: 'explorer', params: { worktreeId }, query: { file: encodeURIComponent(path) } }"
                class="flex w-full items-center gap-2"
                @click="handleOpenChange(false)"
              >
                <FileIcon class="size-4 shrink-0 text-muted-foreground" />
                <span class="truncate text-sm">{{ path }}</span>
              </RouterLink>
            </CommandItem>
          </CommandGroup>
        </template>

        <!-- Commands mode -->
        <template v-else>
          <CommandEmpty>No commands found</CommandEmpty>
          <CommandGroup v-if="navigateCommands.length" heading="Navigate">
            <CommandItem
              v-for="cmd in navigateCommands"
              :key="cmd.id"
              :value="cmd.label"
              as-child
            >
              <RouterLink
                :to="cmd.to(worktreeId ?? '')"
                class="flex w-full items-center gap-2"
                @click="handleOpenChange(false)"
              >
                <component :is="cmd.icon" class="size-4 shrink-0 text-muted-foreground" />
                <span class="text-sm">{{ cmd.label }}</span>
              </RouterLink>
            </CommandItem>
          </CommandGroup>
          <CommandSeparator v-if="navigateCommands.length && actionCommands.length" />
          <CommandGroup v-if="actionCommands.length" heading="Actions">
            <CommandItem
              v-for="cmd in actionCommands"
              :key="cmd.id"
              :value="cmd.label"
              @select="handleAction(cmd.action)"
            >
              <component :is="cmd.icon" class="size-4 shrink-0 text-muted-foreground" />
              <span class="text-sm">{{ cmd.label }}</span>
            </CommandItem>
          </CommandGroup>
        </template>
      </CommandList>
    </template>
  </CommandDialog>
</template>
