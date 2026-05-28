# Command Palette (⌘K) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a global ⌘K command palette with navigate/action commands and `@`-prefixed fuzzy file search scoped to the active worktree.

**Architecture:** A new `command-palette` frontend module holds all UI and state. A new `GET /worktrees/:id/files/search` endpoint on the Node.js server does server-side fuzzy matching against the worktree file tree. The palette is mounted in `WorkspaceView` and opened via a module-level singleton composable.

**Tech Stack:** Vue 3 (Composition API), TanStack Query, shadcn `CommandDialog` (reka-ui), `useEventListener` (vueuse), Node.js Hono server, TypeScript.

---

## File Map

| Action | Path |
|--------|------|
| Create | `frontend/src/modules/command-palette/useCommandPalette.ts` |
| Create | `frontend/src/modules/command-palette/commands.ts` |
| Create | `frontend/src/modules/command-palette/useFileSearch.ts` |
| Create | `frontend/src/modules/command-palette/CommandPalette.vue` |
| Modify | `frontend/src/modules/workspace/pages/WorkspaceView.vue` |
| Modify | `server/modules/workspace/files.ts` |
| Modify | `server/modules/workspace/router.ts` |
| Modify | `server/modules/workspace/files.test.ts` |

---

## Task 1: Server — add `searchFilesForWorktree` to `files.ts`

**Files:**
- Modify: `server/modules/workspace/files.ts`

The existing `listFilesForWorktree` returns all file paths. We add `searchFilesForWorktree` that runs it, scores each path against the query, and returns the top N.

Scoring rules (higher = better match):
- +3 if the filename (last path segment) starts with the query
- +2 if the filename contains the query
- +1 if any path segment contains the query
- 0 if no match (excluded)

- [ ] **Step 1: Add `searchFilesForWorktree` at the bottom of `server/modules/workspace/files.ts`**

```typescript
export async function searchFilesForWorktree(
  worktreePath: string,
  query: string,
  limit: number,
): Promise<string[]> {
  const allPaths = await listFilesForWorktree(worktreePath);
  const q = query.toLowerCase();

  const scored: Array<{ path: string; score: number }> = [];
  for (const p of allPaths) {
    const lower = p.toLowerCase();
    const filename = lower.split("/").at(-1) ?? lower;
    let score = 0;
    if (filename.startsWith(q)) score = 3;
    else if (filename.includes(q)) score = 2;
    else if (lower.includes(q)) score = 1;
    if (score > 0) scored.push({ path: p, score });
  }

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.path);
}
```

- [ ] **Step 2: Commit**

```bash
git add server/modules/workspace/files.ts
git commit -m "feat(server): add searchFilesForWorktree with fuzzy scoring"
```

---

## Task 2: Server — test `searchFilesForWorktree`

**Files:**
- Modify: `server/modules/workspace/files.test.ts`

- [ ] **Step 1: Open `server/modules/workspace/files.test.ts` and add tests at the bottom**

```typescript
import { searchFilesForWorktree } from "./files.js";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("searchFilesForWorktree", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "search-test-"));
    await mkdir(join(dir, "src/components"), { recursive: true });
    await mkdir(join(dir, "src/pages"), { recursive: true });
    await writeFile(join(dir, "src/components/Button.vue"), "");
    await writeFile(join(dir, "src/components/InputGroup.vue"), "");
    await writeFile(join(dir, "src/pages/HomePage.vue"), "");
    await writeFile(join(dir, "README.md"), "");
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("returns paths ranked by filename match quality", async () => {
    const results = await searchFilesForWorktree(dir, "button", 10);
    expect(results[0]).toBe("src/components/Button.vue");
  });

  it("returns empty array when no match", async () => {
    const results = await searchFilesForWorktree(dir, "zzznomatch", 10);
    expect(results).toEqual([]);
  });

  it("respects the limit", async () => {
    const results = await searchFilesForWorktree(dir, "vue", 2);
    expect(results.length).toBeLessThanOrEqual(2);
  });

  it("matches partial filename", async () => {
    const results = await searchFilesForWorktree(dir, "group", 10);
    expect(results).toContain("src/components/InputGroup.vue");
  });
});
```

- [ ] **Step 2: Run tests**

```bash
cd server && pnpm test -- --testPathPattern=files.test
```

Expected: all new tests pass.

- [ ] **Step 3: Commit**

```bash
git add server/modules/workspace/files.test.ts
git commit -m "test(server): add searchFilesForWorktree tests"
```

---

## Task 3: Server — add `GET /worktrees/:id/files/search` route

**Files:**
- Modify: `server/modules/workspace/router.ts`

- [ ] **Step 1: Add the import at the top of `server/modules/workspace/router.ts`** (alongside existing `files.ts` imports)

The existing import line looks like:
```typescript
import { FileReadError, listFilesForWorktree, readFileForWorktree, writeFileForWorktree } from "./files.js";
```

Change it to:
```typescript
import { FileReadError, listFilesForWorktree, readFileForWorktree, writeFileForWorktree, searchFilesForWorktree } from "./files.js";
```

- [ ] **Step 2: Add the route after `.get("/worktrees/:id/files", ...)` in `server/modules/workspace/router.ts`**

The existing route ends with:
```typescript
    .get("/worktrees/:id/files", async (c) => {
      const worktree = await getWorktree(db, c.req.param("id"));
      if (!worktree) return c.json({ error: "Worktree not found" }, 404);
      const paths = await listFilesForWorktree(worktree.path);
```

Add immediately after that route (before `.get("/worktrees/:id/files/content", ...)`):

```typescript
    .get("/worktrees/:id/files/search", async (c) => {
      const worktree = await getWorktree(db, c.req.param("id"));
      if (!worktree) return c.json({ error: "Worktree not found" }, 404);
      const q = c.req.query("q") ?? "";
      const limit = Math.min(parseInt(c.req.query("limit") ?? "50", 10), 100);
      if (!q.trim()) return c.json({ paths: [] });
      const paths = await searchFilesForWorktree(worktree.path, q, limit);
      return c.json({ paths });
    })
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd server && pnpm tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add server/modules/workspace/router.ts
git commit -m "feat(server): add GET /worktrees/:id/files/search route"
```

---

## Task 4: Frontend — `useCommandPalette.ts` (global state + ⌘K shortcut)

**Files:**
- Create: `frontend/src/modules/command-palette/useCommandPalette.ts`

This composable holds module-level (singleton) open state and registers the ⌘K keyboard shortcut when called. Call it once from `WorkspaceView`.

- [ ] **Step 1: Create `frontend/src/modules/command-palette/useCommandPalette.ts`**

```typescript
import { ref } from "vue";
import { useEventListener } from "@vueuse/core";

const isOpen = ref(false);

export function openCommandPalette() {
  isOpen.value = true;
}

export function closeCommandPalette() {
  isOpen.value = false;
}

export function useCommandPalette() {
  useEventListener(window, "keydown", (e: KeyboardEvent) => {
    if (e.metaKey && e.key === "k") {
      e.preventDefault();
      isOpen.value = !isOpen.value;
    }
  }, { capture: true });

  return { isOpen };
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/modules/command-palette/useCommandPalette.ts
git commit -m "feat(command-palette): add useCommandPalette singleton composable"
```

---

## Task 5: Frontend — `commands.ts` (static command registry)

**Files:**
- Create: `frontend/src/modules/command-palette/commands.ts`

Defines the static navigate and action commands. Navigate commands use RouterLink destinations. Action commands carry a string key the palette handler maps to a callback.

- [ ] **Step 1: Create `frontend/src/modules/command-palette/commands.ts`**

```typescript
import type { RouteLocationRaw } from "vue-router";
import {
  TerminalIcon,
  FolderTreeIcon,
  GitBranchIcon,
  SettingsIcon,
  FolderPlusIcon,
  SunMoonIcon,
} from "@lucide/vue";
import type { Component } from "vue";

export type NavigateCommand = {
  type: "navigate";
  id: string;
  label: string;
  icon: Component;
  to: (worktreeId: string) => RouteLocationRaw;
  requiresWorktree: boolean;
};

export type ActionCommand = {
  type: "action";
  id: string;
  label: string;
  icon: Component;
  action: string;
};

export type Command = NavigateCommand | ActionCommand;

export const COMMANDS: Command[] = [
  {
    type: "navigate",
    id: "nav.terminal",
    label: "Open Terminal",
    icon: TerminalIcon,
    to: (worktreeId) => ({ name: "terminal", params: { worktreeId } }),
    requiresWorktree: true,
  },
  {
    type: "navigate",
    id: "nav.explorer",
    label: "Open File Explorer",
    icon: FolderTreeIcon,
    to: (worktreeId) => ({ name: "explorer", params: { worktreeId } }),
    requiresWorktree: true,
  },
  {
    type: "navigate",
    id: "nav.git",
    label: "Open Git Panel",
    icon: GitBranchIcon,
    to: (worktreeId) => ({ name: "git", params: { worktreeId } }),
    requiresWorktree: true,
  },
  {
    type: "navigate",
    id: "nav.settings",
    label: "Open Settings",
    icon: SettingsIcon,
    to: () => ({ name: "settings" }),
    requiresWorktree: false,
  },
  {
    type: "action",
    id: "action.addProject",
    label: "Add Project",
    icon: FolderPlusIcon,
    action: "addProject",
  },
  {
    type: "action",
    id: "action.toggleTheme",
    label: "Toggle Theme",
    icon: SunMoonIcon,
    action: "toggleTheme",
  },
];
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/modules/command-palette/commands.ts
git commit -m "feat(command-palette): add static command registry"
```

---

## Task 6: Frontend — `useFileSearch.ts` (server-side file search)

**Files:**
- Create: `frontend/src/modules/command-palette/useFileSearch.ts`

Calls `GET /api/worktrees/:id/files/search` with a debounced query. Returns reactive `results` and `isLoading`.

- [ ] **Step 1: Create `frontend/src/modules/command-palette/useFileSearch.ts`**

```typescript
import { ref, watch, type Ref } from "vue";
import { useDebounceFn } from "@vueuse/core";
import { apiClient } from "@/lib/api-client";
import { ensureOk } from "@/lib/api-error";

export function useFileSearch(
  worktreeId: Ref<string | undefined>,
  query: Ref<string>,
) {
  const results = ref<string[]>([]);
  const isLoading = ref(false);

  const doSearch = useDebounceFn(async (id: string, q: string) => {
    if (!q.trim()) {
      results.value = [];
      return;
    }
    isLoading.value = true;
    try {
      const res = await apiClient.worktrees[":id"].files.search.$get({
        param: { id },
        query: { q, limit: "50" },
      });
      const data = await ensureOk<{ paths: string[] }>(res);
      results.value = data.paths;
    } catch {
      results.value = [];
    } finally {
      isLoading.value = false;
    }
  }, 150);

  watch(
    [worktreeId, query],
    ([id, q]) => {
      if (!id) {
        results.value = [];
        return;
      }
      void doSearch(id, q);
    },
  );

  return { results, isLoading };
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/modules/command-palette/useFileSearch.ts
git commit -m "feat(command-palette): add useFileSearch composable"
```

---

## Task 7: Frontend — `CommandPalette.vue`

**Files:**
- Create: `frontend/src/modules/command-palette/CommandPalette.vue`

The full palette UI. Uses the existing `CommandDialog` component. Derives mode from input (`@` prefix = file search). Navigation items rendered as `<RouterLink>` via `as-child`. Emits action keys to the parent.

- [ ] **Step 1: Create `frontend/src/modules/command-palette/CommandPalette.vue`**

```vue
<script setup lang="ts">
import { computed, ref } from "vue";
import { RouterLink } from "vue-router";
import { FileIcon } from "@lucide/vue";
import { CommandDialog, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem, CommandSeparator } from "@/components/ui/command";
import { closeCommandPalette } from "./useCommandPalette";
import { COMMANDS } from "./commands";
import { useFileSearch } from "./useFileSearch";

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
      <CommandInput
        v-model="input"
        :placeholder="isFileMode ? 'Search files...' : 'Type a command or @filename...'"
      />
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
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/modules/command-palette/CommandPalette.vue
git commit -m "feat(command-palette): add CommandPalette component"
```

---

## Task 8: Frontend — wire into `WorkspaceView.vue`

**Files:**
- Modify: `frontend/src/modules/workspace/pages/WorkspaceView.vue`

Mount `<CommandPalette>` and handle action callbacks (addProject, toggleTheme).

- [ ] **Step 1: Read `frontend/src/modules/workspace/pages/WorkspaceView.vue` then add imports**

Add to the `<script setup>` imports block:

```typescript
import CommandPalette from "@/modules/command-palette/CommandPalette.vue";
import { useCommandPalette } from "@/modules/command-palette/useCommandPalette";
import { usePickProjectFolderMutation } from "@/modules/workspace/queries";
import { useColorMode } from "@vueuse/core";
```

- [ ] **Step 2: Add composable calls in the `<script setup>` block (after existing composables)**

```typescript
const { isOpen } = useCommandPalette();
const pickProjectFolder = usePickProjectFolderMutation();
const colorMode = useColorMode();

function handlePaletteAction(key: string) {
  if (key === "addProject") {
    void pickProjectFolder.mutateAsync();
  } else if (key === "toggleTheme") {
    colorMode.value = colorMode.value === "dark" ? "light" : "dark";
  }
}
```

- [ ] **Step 3: Add `<CommandPalette>` to the template** — place it just before the closing `</template>` tag, outside `<WorkspaceLayout>`:

```vue
<CommandPalette
  :open="isOpen"
  :worktree-id="worktreeId"
  @update:open="(v) => { isOpen.value = v }"
  @action="handlePaletteAction"
/>
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/modules/workspace/pages/WorkspaceView.vue
git commit -m "feat(command-palette): mount palette in WorkspaceView and wire actions"
```

---

## Task 9: Manual smoke test

- [ ] **Step 1: Start the dev server**

```bash
pnpm dev
```

- [ ] **Step 2: Open the app and verify ⌘K opens the palette**

Expected: a modal appears with a search input and two groups (Navigate, Actions).

- [ ] **Step 3: Type a partial command name (e.g. "git") and verify filtering**

Expected: "Open Git Panel" appears under Navigate.

- [ ] **Step 4: Type `@` then a filename fragment (e.g. `@index`)**

Expected: input placeholder changes to "Search files...", results appear after 150ms debounce.

- [ ] **Step 5: Select a file result**

Expected: palette closes, browser navigates to the explorer panel with the file open.

- [ ] **Step 6: Press Escape**

Expected: palette closes, input cleared.

- [ ] **Step 7: Without a worktree selected (home screen), press ⌘K, type `@`**

Expected: "No active worktree" empty state shown, no network request made.

- [ ] **Step 8: Commit if any last-minute fixes were needed**

```bash
git add -p
git commit -m "fix(command-palette): smoke test fixes"
```
