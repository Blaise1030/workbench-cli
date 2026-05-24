# Keybindings Module Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add configurable keyboard shortcuts (⌘+number, ⌘N, ⌘E, ⌘G) backed by `~/.workbench/keybindings.json` with a Settings UI to edit them.

**Architecture:** Server module reads/writes `~/.workbench/keybindings.json`, merging with hardcoded defaults. A new Hono router exposes GET + PUT endpoints. The client composable `useWorkspaceKeybindings` attaches a single window keydown listener using `@vueuse/core`, fetching the resolved map via TanStack Query. A new Keybindings settings page lets users remap shortcuts via key-capture.

**Tech Stack:** Hono + zValidator, `node:fs/promises` + `node:os`, TanStack Query v5, @vueuse/core `useEventListener`, Vue 3 `<script setup>`, Vitest.

---

## File Map

**New files:**
- `server/modules/keybindings/store.ts` — file I/O, merge with defaults
- `server/modules/keybindings/store.test.ts` — unit tests for store
- `server/modules/keybindings/router.ts` — Hono GET + PUT handlers
- `src/modules/keyboard/types.ts` — `KeybindingAction` union, `KeybindingsMap`
- `src/modules/keyboard/defaults.ts` — `DEFAULT_KEYBINDINGS`
- `src/modules/keyboard/queries/keybindings.ts` — TanStack Query + mutation
- `src/modules/keyboard/hooks/useWorkspaceKeybindings.ts` — keydown composable
- `src/modules/settings/pages/KeybindingsSettings.vue` — settings page

**Modified files:**
- `server/schemas/api.ts` — add `KeybindingsMap`, `putKeybindingsSchema`
- `server/api/index.ts` — register keybindings router
- `src/router/index.ts` — add `settings-keybindings` child route
- `src/modules/settings/layout/SettingsView.vue` — add Keybindings tab
- `src/modules/terminal/layout/TerminalWorkspace.vue` — call composable

---

### Task 1: Server schema types

**Files:**
- Modify: `server/schemas/api.ts`

- [ ] **Step 1: Add types to `server/schemas/api.ts`**

Open `server/schemas/api.ts` and append the following at the end of the file:

```ts
// ── Keybindings ─────────────────────────────────────────────────────────────

export const KEYBINDING_ACTIONS = [
  "terminal.newTerminal",
  "panel.explorer",
  "panel.git",
  "terminal.tab.1",
  "terminal.tab.2",
  "terminal.tab.3",
  "terminal.tab.4",
  "terminal.tab.5",
  "terminal.tab.6",
  "terminal.tab.7",
  "terminal.tab.8",
  "terminal.tab.9",
] as const;

export type KeybindingAction = (typeof KEYBINDING_ACTIONS)[number];

export type KeybindingsMap = Record<KeybindingAction, string>;

// Chord format: one or more of "Meta|Ctrl|Alt|Shift" joined by "+", then "+key"
// e.g. "Meta+n", "Ctrl+Shift+p", "Meta+1"
const chordPattern = /^(Meta|Ctrl|Alt|Shift)(\+(Meta|Ctrl|Alt|Shift))*\+.+$/;

export const putKeybindingsSchema = z.object(
  Object.fromEntries(
    KEYBINDING_ACTIONS.map((a) => [a, z.string().regex(chordPattern)]),
  ) as Record<KeybindingAction, z.ZodString>,
);
```

> **Note:** `z` is already imported in `server/schemas/api.ts`. Check the existing imports before adding a new one.

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/blaisetiong/Developer/v2 && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors (or only pre-existing unrelated errors).

- [ ] **Step 3: Commit**

```bash
git add server/schemas/api.ts
git commit -m "feat(keybindings): add KeybindingsMap schema types"
```

---

### Task 2: Server store (file I/O)

**Files:**
- Create: `server/modules/keybindings/store.ts`
- Create: `server/modules/keybindings/store.test.ts`

- [ ] **Step 1: Write the failing test** — create `server/modules/keybindings/store.test.ts`

```ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getKeybindings, putKeybindings } from "./store.js";
import { DEFAULT_KEYBINDINGS } from "./store.js";

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), "keybindings-test-"));
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

describe("getKeybindings", () => {
  it("returns defaults when file does not exist", async () => {
    const result = await getKeybindings(join(tmpDir, "missing.json"));
    expect(result).toEqual(DEFAULT_KEYBINDINGS);
  });

  it("merges file overrides over defaults", async () => {
    const filePath = join(tmpDir, "kb.json");
    await putKeybindings({ ...DEFAULT_KEYBINDINGS, "terminal.newTerminal": "Ctrl+t" }, filePath);
    const result = await getKeybindings(filePath);
    expect(result["terminal.newTerminal"]).toBe("Ctrl+t");
    expect(result["panel.git"]).toBe(DEFAULT_KEYBINDINGS["panel.git"]);
  });
});

describe("putKeybindings", () => {
  it("writes the map and reads it back unchanged", async () => {
    const filePath = join(tmpDir, "kb.json");
    const custom = { ...DEFAULT_KEYBINDINGS, "panel.explorer": "Meta+f" };
    await putKeybindings(custom, filePath);
    const result = await getKeybindings(filePath);
    expect(result["panel.explorer"]).toBe("Meta+f");
  });

  it("creates parent directory if missing", async () => {
    const filePath = join(tmpDir, "nested", "dir", "kb.json");
    await expect(putKeybindings(DEFAULT_KEYBINDINGS, filePath)).resolves.not.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/blaisetiong/Developer/v2 && npx vitest run server/modules/keybindings/store.test.ts 2>&1 | tail -15
```

Expected: FAIL — "Cannot find module './store.js'"

- [ ] **Step 3: Implement `server/modules/keybindings/store.ts`**

```ts
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import { join, dirname } from "node:path";
import type { KeybindingsMap } from "../../schemas/api.js";

export const DEFAULT_KEYBINDING_PATH = join(homedir(), ".workbench", "keybindings.json");

export const DEFAULT_KEYBINDINGS: KeybindingsMap = {
  "terminal.newTerminal": "Meta+n",
  "panel.explorer": "Meta+e",
  "panel.git": "Meta+g",
  "terminal.tab.1": "Meta+1",
  "terminal.tab.2": "Meta+2",
  "terminal.tab.3": "Meta+3",
  "terminal.tab.4": "Meta+4",
  "terminal.tab.5": "Meta+5",
  "terminal.tab.6": "Meta+6",
  "terminal.tab.7": "Meta+7",
  "terminal.tab.8": "Meta+8",
  "terminal.tab.9": "Meta+9",
};

export async function getKeybindings(
  filePath = DEFAULT_KEYBINDING_PATH,
): Promise<KeybindingsMap> {
  try {
    const raw = await readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as Partial<KeybindingsMap>;
    return { ...DEFAULT_KEYBINDINGS, ...parsed };
  } catch {
    return { ...DEFAULT_KEYBINDINGS };
  }
}

export async function putKeybindings(
  map: KeybindingsMap,
  filePath = DEFAULT_KEYBINDING_PATH,
): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(map, null, 2), "utf8");
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Users/blaisetiong/Developer/v2 && npx vitest run server/modules/keybindings/store.test.ts 2>&1 | tail -15
```

Expected: all 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add server/modules/keybindings/
git commit -m "feat(keybindings): add server store with file I/O and tests"
```

---

### Task 3: Server router

**Files:**
- Create: `server/modules/keybindings/router.ts`

- [ ] **Step 1: Create `server/modules/keybindings/router.ts`**

```ts
import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { requireSession } from "../auth/middleware.js";
import type { Session } from "../auth/session.js";
import { putKeybindingsSchema } from "../../schemas/api.js";
import type { KeybindingsMap } from "../../schemas/api.js";
import { getKeybindings, putKeybindings } from "./store.js";

export function createKeybindingsRouter(session: Session) {
  return new Hono()
    .use("*", requireSession(session))
    .get("/", async (c) => {
      const map = await getKeybindings();
      return c.json(map);
    })
    .put("/", zValidator("json", putKeybindingsSchema), async (c) => {
      const map = c.req.valid("json") as KeybindingsMap;
      await putKeybindings(map);
      return c.json(map);
    });
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/blaisetiong/Developer/v2 && npx tsc --noEmit 2>&1 | head -20
```

Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add server/modules/keybindings/router.ts
git commit -m "feat(keybindings): add Hono router with GET and PUT handlers"
```

---

### Task 4: Wire server router

**Files:**
- Modify: `server/api/index.ts`

- [ ] **Step 1: Register the keybindings router in `server/api/index.ts`**

Add the import:
```ts
import { createKeybindingsRouter } from "../modules/keybindings/router.js";
```

Extend the chain inside `createApiRouter` — add after the existing `.route("/settings", ...)` line:
```ts
.route("/keybindings", createKeybindingsRouter(session))
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/blaisetiong/Developer/v2 && npx tsc --noEmit 2>&1 | head -20
```

Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add server/api/index.ts
git commit -m "feat(keybindings): register keybindings router at /api/keybindings"
```

---

### Task 5: Client types and defaults

**Files:**
- Create: `src/modules/keyboard/types.ts`
- Create: `src/modules/keyboard/defaults.ts`

- [ ] **Step 1: Create `src/modules/keyboard/types.ts`**

```ts
import type { KeybindingAction, KeybindingsMap } from "@server/schemas/api";

export type { KeybindingAction, KeybindingsMap };

export interface KeybindingDescriptor {
  action: KeybindingAction;
  label: string;
  description: string;
}

export const KEYBINDING_DESCRIPTORS: KeybindingDescriptor[] = [
  { action: "terminal.newTerminal", label: "New Terminal", description: "Open a new terminal tab" },
  { action: "panel.explorer", label: "File Explorer", description: "Open the file explorer panel" },
  { action: "panel.git", label: "Git", description: "Open the git panel" },
  { action: "terminal.tab.1", label: "Switch to Tab 1", description: "Navigate to terminal tab 1" },
  { action: "terminal.tab.2", label: "Switch to Tab 2", description: "Navigate to terminal tab 2" },
  { action: "terminal.tab.3", label: "Switch to Tab 3", description: "Navigate to terminal tab 3" },
  { action: "terminal.tab.4", label: "Switch to Tab 4", description: "Navigate to terminal tab 4" },
  { action: "terminal.tab.5", label: "Switch to Tab 5", description: "Navigate to terminal tab 5" },
  { action: "terminal.tab.6", label: "Switch to Tab 6", description: "Navigate to terminal tab 6" },
  { action: "terminal.tab.7", label: "Switch to Tab 7", description: "Navigate to terminal tab 7" },
  { action: "terminal.tab.8", label: "Switch to Tab 8", description: "Navigate to terminal tab 8" },
  { action: "terminal.tab.9", label: "Switch to Tab 9", description: "Navigate to terminal tab 9" },
];
```

- [ ] **Step 2: Create `src/modules/keyboard/defaults.ts`**

```ts
import type { KeybindingsMap } from "./types";

export const DEFAULT_KEYBINDINGS: KeybindingsMap = {
  "terminal.newTerminal": "Meta+n",
  "panel.explorer": "Meta+e",
  "panel.git": "Meta+g",
  "terminal.tab.1": "Meta+1",
  "terminal.tab.2": "Meta+2",
  "terminal.tab.3": "Meta+3",
  "terminal.tab.4": "Meta+4",
  "terminal.tab.5": "Meta+5",
  "terminal.tab.6": "Meta+6",
  "terminal.tab.7": "Meta+7",
  "terminal.tab.8": "Meta+8",
  "terminal.tab.9": "Meta+9",
};
```

- [ ] **Step 3: Commit**

```bash
git add src/modules/keyboard/
git commit -m "feat(keybindings): add client types and default bindings"
```

---

### Task 6: Client query and mutation

**Files:**
- Create: `src/modules/keyboard/queries/keybindings.ts`

- [ ] **Step 1: Create `src/modules/keyboard/queries/keybindings.ts`**

```ts
import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/vue-query";
import { apiClient } from "@/lib/api-client";
import { ensureOk } from "@/lib/api-error";
import type { KeybindingsMap } from "../types";
import { DEFAULT_KEYBINDINGS } from "../defaults";

export const keybindingsKeys = {
  all: ["keybindings"] as const,
};

export function keybindingsQueryOptions() {
  return queryOptions({
    queryKey: keybindingsKeys.all,
    queryFn: async () => {
      const res = await apiClient.keybindings.$get();
      return ensureOk<KeybindingsMap>(res);
    },
    placeholderData: DEFAULT_KEYBINDINGS,
  });
}

export function useKeybindingsQuery() {
  return useQuery(keybindingsQueryOptions());
}

export function useUpdateKeybindingsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (map: KeybindingsMap) => {
      const res = await apiClient.keybindings.$put({ json: map });
      return ensureOk<KeybindingsMap>(res);
    },
    onSuccess: (data) => {
      queryClient.setQueryData(keybindingsKeys.all, data);
    },
  });
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/blaisetiong/Developer/v2 && npx tsc --noEmit 2>&1 | head -20
```

Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/modules/keyboard/queries/
git commit -m "feat(keybindings): add TanStack Query fetch and update mutation"
```

---

### Task 7: Client composable

**Files:**
- Create: `src/modules/keyboard/hooks/useWorkspaceKeybindings.ts`

- [ ] **Step 1: Create `src/modules/keyboard/hooks/useWorkspaceKeybindings.ts`**

```ts
import { useEventListener } from "@vueuse/core";
import type { ComputedRef } from "vue";
import { toValue, type MaybeRefOrGetter } from "vue";
import { useKeybindingsQuery } from "../queries/keybindings";
import { DEFAULT_KEYBINDINGS } from "../defaults";
import type { KeybindingAction, KeybindingsMap } from "../types";

interface WorkspaceKeybindingOptions {
  terminalTabItems: ComputedRef<{ id: string }[]>;
  navigateToTerminal: (id: string) => void;
  addTerminal: () => Promise<void>;
  openAuxPanel: (type: "git" | "explorer") => void;
}

const INPUT_TAGS = new Set(["INPUT", "TEXTAREA", "SELECT"]);

function eventToChord(e: KeyboardEvent): string {
  const parts: string[] = [];
  if (e.metaKey) parts.push("Meta");
  if (e.ctrlKey) parts.push("Ctrl");
  if (e.altKey) parts.push("Alt");
  if (e.shiftKey) parts.push("Shift");
  const key = e.key;
  if (!["Meta", "Control", "Alt", "Shift"].includes(key)) {
    parts.push(key.length === 1 ? key.toLowerCase() : key);
  }
  return parts.join("+");
}

function isInputTarget(e: KeyboardEvent): boolean {
  const el = e.target as HTMLElement | null;
  if (!el) return false;
  if (INPUT_TAGS.has(el.tagName)) return true;
  if (el.isContentEditable) return true;
  return false;
}

export function useWorkspaceKeybindings(options: WorkspaceKeybindingOptions) {
  const { terminalTabItems, navigateToTerminal, addTerminal, openAuxPanel } = options;
  const { data: bindings } = useKeybindingsQuery();

  useEventListener(window, "keydown", (e: KeyboardEvent) => {
    if (isInputTarget(e)) return;

    const chord = eventToChord(e);
    if (!chord) return;

    const map: KeybindingsMap = bindings.value ?? DEFAULT_KEYBINDINGS;
    const matched = (Object.keys(map) as KeybindingAction[]).find(
      (action) => map[action] === chord,
    );
    if (!matched) return;

    e.preventDefault();

    if (matched === "terminal.newTerminal") {
      void addTerminal();
      return;
    }
    if (matched === "panel.explorer") {
      openAuxPanel("explorer");
      return;
    }
    if (matched === "panel.git") {
      openAuxPanel("git");
      return;
    }
    // terminal.tab.N
    const tabMatch = matched.match(/^terminal\.tab\.(\d)$/);
    if (tabMatch) {
      const index = parseInt(tabMatch[1], 10) - 1;
      const tab = terminalTabItems.value[index];
      if (tab) navigateToTerminal(tab.id);
    }
  });
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/blaisetiong/Developer/v2 && npx tsc --noEmit 2>&1 | head -20
```

Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/modules/keyboard/hooks/
git commit -m "feat(keybindings): add useWorkspaceKeybindings composable"
```

---

### Task 8: Wire composable into TerminalWorkspace

**Files:**
- Modify: `src/modules/terminal/layout/TerminalWorkspace.vue`

- [ ] **Step 1: Add import in `<script setup>` of `TerminalWorkspace.vue`**

Add after the existing imports (anywhere before the `</script>` closing of the setup block):

```ts
import { useWorkspaceKeybindings } from "@/modules/keyboard/hooks/useWorkspaceKeybindings";
```

- [ ] **Step 2: Call the composable after the existing function definitions in `TerminalWorkspace.vue`**

After the `openAuxPanel` function definition, add:

```ts
useWorkspaceKeybindings({
  terminalTabItems,
  navigateToTerminal,
  addTerminal,
  openAuxPanel,
});
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /Users/blaisetiong/Developer/v2 && npx tsc --noEmit 2>&1 | head -20
```

Expected: no new errors.

- [ ] **Step 4: Start the dev server and manually verify shortcuts work**

```bash
cd /Users/blaisetiong/Developer/v2 && npm run dev
```

- Open the app in a browser.
- Navigate to a worktree.
- Press ⌘N — a new terminal tab should open.
- Press ⌘1, ⌘2 — should switch between terminal tabs.
- Press ⌘E — file explorer panel should open.
- Press ⌘G — git panel should open.
- Stop the server (Ctrl+C).

- [ ] **Step 5: Commit**

```bash
git add src/modules/terminal/layout/TerminalWorkspace.vue
git commit -m "feat(keybindings): wire useWorkspaceKeybindings into TerminalWorkspace"
```

---

### Task 9: Settings route

**Files:**
- Modify: `src/router/index.ts`
- Modify: `src/modules/settings/layout/SettingsView.vue`

- [ ] **Step 1: Add route to `src/router/index.ts`**

Add the import at the top of the router file:

```ts
import KeybindingsSettings from "@/modules/settings/pages/KeybindingsSettings.vue";
```

Inside the `settings` route's `children` array, add:

```ts
{ path: "keybindings", name: "settings-keybindings", component: KeybindingsSettings },
```

- [ ] **Step 2: Add tab to `src/modules/settings/layout/SettingsView.vue`**

In the tab bar `<div class="flex gap-1 border-b mb-4">`, add after the existing Network button:

```html
<button
  class="px-3 py-1.5 text-sm transition-colors"
  :class="route.name === 'settings-keybindings'
    ? 'border-b-2 border-foreground font-medium text-foreground'
    : 'text-muted-foreground hover:text-foreground'"
  @click="router.push({ name: 'settings-keybindings' })"
>
  Keybindings
</button>
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /Users/blaisetiong/Developer/v2 && npx tsc --noEmit 2>&1 | head -20
```

Expected: no new errors (the `KeybindingsSettings` component doesn't exist yet — expect one error about it, which disappears in Task 10).

- [ ] **Step 4: Commit**

```bash
git add src/router/index.ts src/modules/settings/layout/SettingsView.vue
git commit -m "feat(keybindings): add settings-keybindings route and tab"
```

---

### Task 10: Keybindings settings page

**Files:**
- Create: `src/modules/settings/pages/KeybindingsSettings.vue`

- [ ] **Step 1: Create `src/modules/settings/pages/KeybindingsSettings.vue`**

```vue
<script setup lang="ts">
import { ref, reactive } from "vue";
import { KEYBINDING_DESCRIPTORS } from "@/modules/keyboard/types";
import { DEFAULT_KEYBINDINGS } from "@/modules/keyboard/defaults";
import {
  useKeybindingsQuery,
  useUpdateKeybindingsMutation,
} from "@/modules/keyboard/queries/keybindings";
import type { KeybindingAction, KeybindingsMap } from "@/modules/keyboard/types";
import { toast } from "vue-sonner";

const { data: serverBindings } = useKeybindingsQuery();
const updateMutation = useUpdateKeybindingsMutation();

// Local draft — initialised from server data once loaded
const draft = reactive<KeybindingsMap>({ ...DEFAULT_KEYBINDINGS });

watch(
  serverBindings,
  (val) => {
    if (val) Object.assign(draft, val);
  },
  { immediate: true },
);

const capturingAction = ref<KeybindingAction | null>(null);
const captureDisplay = ref<string>("");
const hasConflict = ref<KeybindingAction | null>(null);

function chordLabel(chord: string): string {
  return chord
    .replace("Meta", "⌘")
    .replace("Ctrl", "⌃")
    .replace("Alt", "⌥")
    .replace("Shift", "⇧")
    .replace(/\+/g, "");
}

function startCapture(action: KeybindingAction) {
  capturingAction.value = action;
  captureDisplay.value = "Press keys…";
  hasConflict.value = null;
}

function eventToChord(e: KeyboardEvent): string {
  const parts: string[] = [];
  if (e.metaKey) parts.push("Meta");
  if (e.ctrlKey) parts.push("Ctrl");
  if (e.altKey) parts.push("Alt");
  if (e.shiftKey) parts.push("Shift");
  const key = e.key;
  if (!["Meta", "Control", "Alt", "Shift"].includes(key)) {
    parts.push(key.length === 1 ? key.toLowerCase() : key);
  }
  return parts.join("+");
}

function onCaptureKeydown(e: KeyboardEvent) {
  if (!capturingAction.value) return;
  e.preventDefault();
  e.stopPropagation();

  if (e.key === "Escape") {
    capturingAction.value = null;
    return;
  }

  const chord = eventToChord(e);
  if (!chord.includes("+")) return; // bare modifier, wait for full combo

  captureDisplay.value = chordLabel(chord);

  const conflict = (Object.keys(draft) as KeybindingAction[]).find(
    (a) => a !== capturingAction.value && draft[a] === chord,
  );
  hasConflict.value = conflict ?? null;

  draft[capturingAction.value] = chord;
  capturingAction.value = null;
}

async function save() {
  try {
    await updateMutation.mutateAsync({ ...draft });
    toast.success("Keybindings saved");
  } catch {
    toast.error("Failed to save keybindings");
  }
}

function resetToDefaults() {
  Object.assign(draft, DEFAULT_KEYBINDINGS);
}
</script>

<template>
  <div @keydown="onCaptureKeydown" tabindex="-1">
    <div class="flex items-center justify-between mb-4">
      <h2 class="text-sm font-medium">Keyboard Shortcuts</h2>
      <div class="flex gap-2">
        <button
          class="px-3 py-1 text-xs rounded border text-muted-foreground hover:text-foreground"
          @click="resetToDefaults"
        >
          Reset to defaults
        </button>
        <button
          class="px-3 py-1 text-xs rounded bg-foreground text-background hover:opacity-90"
          :disabled="updateMutation.isPending.value"
          @click="save"
        >
          {{ updateMutation.isPending.value ? "Saving…" : "Save" }}
        </button>
      </div>
    </div>

    <div v-if="hasConflict" class="mb-3 text-xs text-amber-500">
      Conflict: this chord is also assigned to "{{ KEYBINDING_DESCRIPTORS.find(d => d.action === hasConflict)?.label }}". Both will be saved — last key pressed wins.
    </div>

    <table class="w-full text-sm">
      <thead>
        <tr class="border-b text-xs text-muted-foreground">
          <th class="pb-2 text-left font-normal">Action</th>
          <th class="pb-2 text-left font-normal">Description</th>
          <th class="pb-2 text-left font-normal">Shortcut</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="desc in KEYBINDING_DESCRIPTORS"
          :key="desc.action"
          class="border-b last:border-0"
        >
          <td class="py-2 pr-4 font-medium">{{ desc.label }}</td>
          <td class="py-2 pr-4 text-muted-foreground text-xs">{{ desc.description }}</td>
          <td class="py-2">
            <button
              class="inline-flex items-center gap-1 rounded border px-2 py-0.5 text-xs font-mono"
              :class="capturingAction === desc.action
                ? 'border-foreground bg-muted animate-pulse'
                : 'hover:border-foreground/50'"
              @click="startCapture(desc.action)"
            >
              {{ capturingAction === desc.action
                ? captureDisplay
                : chordLabel(draft[desc.action]) }}
            </button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
```

- [ ] **Step 2: Verify TypeScript compiles cleanly**

```bash
cd /Users/blaisetiong/Developer/v2 && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 3: Run the app and verify the Settings UI**

```bash
cd /Users/blaisetiong/Developer/v2 && npm run dev
```

- Open Settings → click "Keybindings" tab.
- Table shows all 13 actions with default chords.
- Click a shortcut cell → shows "Press keys…" and animates.
- Press ⌘T → cell updates to show the new chord.
- Click Save → success toast appears.
- Refresh the page → saved chord persists (loaded from server).
- Click "Reset to defaults" then Save → chords return to defaults.
- Stop the server (Ctrl+C).

- [ ] **Step 4: Commit**

```bash
git add src/modules/settings/pages/KeybindingsSettings.vue
git commit -m "feat(keybindings): add KeybindingsSettings page with key capture and save"
```

---

### Task 11: Run all tests

- [ ] **Step 1: Run the full test suite**

```bash
cd /Users/blaisetiong/Developer/v2 && npm test 2>&1 | tail -20
```

Expected: all tests pass including the new store tests.

- [ ] **Step 2: Final commit if any fixups needed**

If tests reveal issues, fix them and commit:

```bash
git add -p
git commit -m "fix(keybindings): address test failures"
```
