<script setup lang="ts">
import { computed, defineComponent, nextTick, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { useQuery } from "@tanstack/vue-query";
import { FileIcon, LoaderIcon, SearchIcon } from "@lucide/vue";
import { Command, CommandInput, CommandList, CommandGroup, CommandItem, CommandSeparator, useCommand } from "@/components/ui/command";
import { Kbd } from "@/components/ui/kbd";
import { closeCommandPalette, savedInput, pendingInitialInput, recentFiles, addRecentFile } from "./useCommandPalette";
import { COMMANDS } from "./commands";
import { useFileSearch } from "./useFileSearch";
import { useContentSearch } from "./useContentSearch";
import { useKeybindingsQuery } from "@/modules/keyboard/queries/keybindings";
import { worktreeQueryOptions } from "@/modules/workspace/queries";
import { chordLabel } from "@/modules/keyboard/chord";
import { KEYBINDING_OPTIONS } from "@/modules/keyboard/options";
import type { RouteLocationRaw } from "vue-router";
import type { KeybindingAction } from "@/modules/keyboard/types";

// Exposes a setter into the Command's filterState so the parent can seed the
// initial search value after the Command mounts (filterState lives inside Command).
const setSearch = ref<((v: string) => void) | null>(null);

// Syncs filterState.search (driven by CommandInput) → `input` ref so the
// parent can detect @-file mode without needing to access the Command context.
const CommandFilterBridge = defineComponent({
  setup() {
    const { filterState } = useCommand();
    watch(() => filterState.search, (v) => { input.value = v; });
    setSearch.value = (v: string) => { filterState.search = v; };
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

const router = useRouter();
const input = ref("");
const paletteRef = ref<HTMLElement | null>(null);

// Prevent double-execution when both reka-ui's Enter handler and our fallback fire.
let closing = false;

watch(() => props.open, (isOpen) => {
  if (isOpen) {
    const initial = pendingInitialInput.value || savedInput.value;
    pendingInitialInput.value = "";
    closing = false;
    // Sync immediately so isFileMode computed is correct before render.
    input.value = initial;
    nextTick(() => {
      if (initial) setSearch.value?.(initial);
      paletteRef.value?.querySelector<HTMLInputElement>("[data-slot=command-input]")?.focus();
    });
  }
});

const isFileMode = computed(() => input.value.startsWith("@"));
const fileQuery = computed(() => (isFileMode.value ? input.value.slice(1) : ""));
const isContentMode = computed(() => !isFileMode.value && input.value.startsWith(">"));
const contentQuery = computed(() => (isContentMode.value ? input.value.slice(1).trim() : ""));

const worktreeIdRef = computed(() => props.worktreeId);
const { results: fileResults, isLoading: fileLoading } = useFileSearch(worktreeIdRef, fileQuery);
const { results: contentResults, isLoading: contentLoading, resultCount: contentResultCount } = useContentSearch(worktreeIdRef, contentQuery);
const { data: worktree } = useQuery(worktreeQueryOptions(() => props.worktreeId ?? ""));

function fileName(path: string) { return path.split("/").at(-1) ?? path; }
function fileDirname(path: string) { const i = path.lastIndexOf("/"); return i >= 0 ? path.slice(0, i) : ""; }
function highlightMatch(text: string, query: string) {
  const i = text.toLowerCase().indexOf(query.toLowerCase());
  if (i === -1) return { before: text.trimEnd(), match: "", after: "" };
  return { before: text.slice(0, i), match: text.slice(i, i + query.length), after: text.slice(i + query.length).trimEnd() };
}
function fullFilePath(relativePath: string) {
  const base = worktree.value?.path ?? "";
  return base ? `${base}/${relativePath}` : relativePath;
}

const visibleRecentFiles = computed(() =>
  recentFiles.value.filter((p) => props.worktreeId),
);

const { data: keybindings } = useKeybindingsQuery();

const filteredCommands = computed(() => {
  const q = (isFileMode.value || isContentMode.value) ? "" : input.value.toLowerCase();
  return COMMANDS.filter((cmd) => {
    if (cmd.type === "navigate" && cmd.requiresWorktree && !props.worktreeId) return false;
    return !q || cmd.label.toLowerCase().includes(q);
  });
});

function cmdKbd(cmd: { keybindingAction?: string }): string[] {
  if (!cmd.keybindingAction) return [];
  const map = keybindings.value ?? KEYBINDING_OPTIONS;
  const chord = map[cmd.keybindingAction as keyof typeof map];
  if (!chord) return [];
  return [chordLabel(chord)];
}

const navigateCommands = computed(() => filteredCommands.value.filter((c) => c.type === "navigate"));
const actionCommands = computed(() => filteredCommands.value.filter((c) => c.type === "action"));

function handleOpenChange(value: boolean) {
  if (!value) {
    if (closing) return;
    closing = true;
    savedInput.value = input.value;
    closeCommandPalette();
    nextTick(() => { closing = false; });
  }
  emit("update:open", value);
}

function navigateTo(to: RouteLocationRaw) {
  router.push(to);
  handleOpenChange(false);
}

function openFile(relativePath: string) {
  addRecentFile(relativePath);
  navigateTo({ name: "explorer", params: { worktreeId: props.worktreeId }, query: { file: encodeURIComponent(fullFilePath(relativePath)) } });
}

function handleAction(key: string) {
  emit("action", key);
  handleOpenChange(false);
}

// Fallback Enter handler: reka-ui's ListboxFilter may not fire @select on Enter
// in all versions. We find the highlighted item and click it explicitly.
function handleEnterFallback() {
  const highlighted = paletteRef.value?.querySelector<HTMLElement>("[data-highlighted]");
  highlighted?.click();
}

const GROUP_HEADING_CLASS =
  "p-0! [&_[data-slot=command-group-heading]]:px-2 [&_[data-slot=command-group-heading]]:py-1 [&_[data-slot=command-group-heading]]:text-xs [&_[data-slot=command-group-heading]]:font-medium [&_[data-slot=command-group-heading]]:text-muted-foreground";

const ITEM_CLASS =
  "py-1.5! px-2! rounded-lg! data-highlighted:bg-muted! data-highlighted:text-foreground! hover:bg-muted hover:text-foreground";
</script>

<template>
  <Teleport to="body">
    <template v-if="open">
      <!-- Transparent backdrop — click outside to close -->
      <div class="fixed inset-0 z-40" @pointerdown="handleOpenChange(false)" />

      <!-- Panel -->
      <div class="fixed inset-x-0 top-12 z-50 flex justify-center px-4 pointer-events-none">
        <div
          ref="paletteRef"
          class="w-full max-w-2xl bg-popover rounded-xl ring-1 ring-foreground/10 shadow-2xl overflow-hidden pointer-events-auto"
          @keydown.esc="handleOpenChange(false)"
          @keydown.enter="handleEnterFallback"
        >
          <Command class="rounded-none! bg-transparent! p-0! h-auto!" :disable-filter="isFileMode || isContentMode">
            <CommandFilterBridge />

            <!-- Search input row — CommandInput keeps ListboxFilter wired to the
                 ListboxRoot context so arrow-key navigation works correctly -->
            <div
              class="flex items-center gap-3 px-3 border-b border-border/50
                     [&_[data-slot=command-input-wrapper]]:flex-1
                     [&_[data-slot=command-input-wrapper]]:p-0
                     [&_[data-slot=input-group]]:bg-transparent!
                     [&_[data-slot=input-group]]:border-0!
                     [&_[data-slot=input-group]]:rounded-none!
                     [&_[data-slot=input-group]]:shadow-none!
                     [&_[data-slot=input-group]]:h-auto!
                     [&_[data-slot=input-group-addon]]:hidden"
            >
              <SearchIcon v-if="!contentLoading" class="size-4 shrink-0 text-muted-foreground" />
              <LoaderIcon v-else class="size-4 shrink-0 text-muted-foreground animate-spin" />
              <CommandInput
                placeholder="Type a command, @filename, or >search content..."
                class="py-3!"
              />
            </div>
            <div
              v-if="isContentMode && contentQuery && !contentLoading && contentResults.length > 0"
              class="px-3 py-1 text-xs text-muted-foreground border-b border-border/50"
            >
              {{ contentResultCount }} result{{ contentResultCount === 1 ? '' : 's' }}
            </div>

            <!-- Scrollable list with gradient fade -->
            <div class="relative">              
              <CommandList class="max-h-80! px-1">
                 <!-- Gradient scroll fade -->
              <div
                class="sticky top-0 inset-x-0 h-2 bg-gradient-to-t from-popover to-transparent pointer-events-none rounded-b-xl"
              />
                <!-- Content search mode -->
                <template v-if="isContentMode">
                  <div
                    v-if="!contentResults.length"
                    class="py-6 text-center text-xs text-muted-foreground"
                  >
                    <span v-if="!worktreeId">No active worktree</span>
                    <span v-else-if="!contentQuery">Type to search file contents</span>
                    <span v-else-if="contentLoading">Searching...</span>
                    <span v-else>No results found</span>
                  </div>
                  <CommandGroup v-if="contentResults.length" heading="In files" :class="GROUP_HEADING_CLASS">
                    <CommandItem
                      v-for="match in contentResults"
                      :key="`${match.file}:${match.line}`"
                      :value="`${match.file}:${match.line}`"
                      :class="ITEM_CLASS"
                      @select="() => openFile(match.file)"
                    >
                      <div class="flex flex-col gap-0.5 min-w-0 w-full">
                        <div class="flex items-center gap-2">
                          <span class="text-sm shrink-0 truncate">{{ fileName(match.file) }}</span>
                          <span class="text-xs text-muted-foreground shrink-0">:{{ match.line }}</span>
                          <span class="truncate text-xs text-muted-foreground">{{ fileDirname(match.file) }}</span>
                        </div>
                        <div class="text-xs font-mono text-muted-foreground truncate">
                          <span>{{ highlightMatch(match.text, contentQuery).before }}</span>
                          <mark class="bg-yellow-200/30 text-foreground rounded-sm not-italic">{{ highlightMatch(match.text, contentQuery).match }}</mark>
                          <span>{{ highlightMatch(match.text, contentQuery).after }}</span>
                        </div>
                      </div>
                    </CommandItem>
                  </CommandGroup>
                </template>

                <!-- File mode -->
                <template v-else-if="isFileMode">
                  <!-- Empty query: show recents -->
                  <template v-if="!fileQuery">
                    <div
                      v-if="!visibleRecentFiles.length"
                      class="py-6 text-center text-xs text-muted-foreground"
                    >
                      <span v-if="!worktreeId">No active worktree</span>
                      <span v-else>Type to search files</span>
                    </div>
                    <CommandGroup v-if="visibleRecentFiles.length" heading="Recent" :class="GROUP_HEADING_CLASS">
                      <CommandItem
                        v-for="path in visibleRecentFiles"
                        :key="path"
                        :value="path"
                        :class="ITEM_CLASS"
                        @select="() => openFile(path)"
                      >
                        <FileIcon class="size-4 shrink-0 text-muted-foreground" />
                        <span class="text-sm shrink-0">{{ fileName(path) }}</span>
                        <span class="truncate text-xs text-muted-foreground">{{ fileDirname(path) }}</span>
                      </CommandItem>
                    </CommandGroup>
                  </template>

                  <!-- Active query: show search results -->
                  <template v-else>
                    <div
                      v-if="!fileResults.length"
                      class="py-6 text-center text-xs text-muted-foreground"
                    >
                      <span v-if="!worktreeId">No active worktree</span>
                      <span v-else-if="fileLoading">Searching...</span>
                      <span v-else>No files found</span>
                    </div>
                    <CommandGroup v-if="fileResults.length" heading="Files" :class="GROUP_HEADING_CLASS">
                      <CommandItem
                        v-for="path in fileResults"
                        :key="path"
                        :value="path"
                        :class="ITEM_CLASS"
                        @select="() => openFile(path)"
                      >
                        <FileIcon class="size-4 shrink-0 text-muted-foreground" />
                        <span class="text-sm shrink-0">{{ fileName(path) }}</span>
                        <span class="truncate text-xs text-muted-foreground">{{ fileDirname(path) }}</span>
                      </CommandItem>
                    </CommandGroup>
                  </template>
                </template>

                <!-- Command mode -->
                <template v-else>
                  <div
                    v-if="!navigateCommands.length && !actionCommands.length"
                    class="py-6 text-center text-xs text-muted-foreground"
                  >
                    No commands found
                  </div>

                  <CommandGroup v-if="navigateCommands.length" heading="Navigate" :class="GROUP_HEADING_CLASS">
                    <CommandItem
                      v-for="cmd in navigateCommands"
                      :key="cmd.id"
                      :value="cmd.label"
                      :class="ITEM_CLASS"
                      @select="() => navigateTo(cmd.to(worktreeId ?? ''))"
                    >
                      <component :is="cmd.icon" class="size-4 shrink-0 text-muted-foreground" />
                      <span class="flex-1 text-sm">{{ cmd.label }}</span>
                      <span v-if="cmdKbd(cmd).length" class="ml-auto flex items-center gap-0.5">
                        <Kbd v-for="k in cmdKbd(cmd)" :key="k">{{ k }}</Kbd>
                      </span>
                    </CommandItem>
                  </CommandGroup>

                  <CommandSeparator
                    v-if="navigateCommands.length && actionCommands.length"
                    class="my-1!"
                  />

                  <CommandGroup v-if="actionCommands.length" heading="Actions" :class="GROUP_HEADING_CLASS">
                    <CommandItem
                      v-for="cmd in actionCommands"
                      :key="cmd.id"
                      :value="cmd.label"
                      :class="ITEM_CLASS"
                      @select="() => handleAction(cmd.action)"
                    >
                      <component :is="cmd.icon" class="size-4 shrink-0 text-muted-foreground" />
                      <span class="flex-1 text-sm">{{ cmd.label }}</span>
                      <span v-if="cmdKbd(cmd).length" class="ml-auto flex items-center gap-0.5">
                        <Kbd v-for="k in cmdKbd(cmd)" :key="k">{{ k }}</Kbd>
                      </span>
                    </CommandItem>
                  </CommandGroup>
                </template>
              </CommandList>

              <!-- Gradient scroll fade -->
              <div
                class="sticky bottom-0 inset-x-0 h-2 bg-gradient-to-t from-popover to-transparent pointer-events-none rounded-b-xl"
              />
            </div>
          </Command>
        </div>
      </div>
    </template>
  </Teleport>
</template>
