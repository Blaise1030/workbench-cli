# Vue Router Tabs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace manual `activeId` tab tracking with Vue Router nested routes for workspace panels and settings tabs.

**Architecture:** Workspace panel tabs (`/w/:worktreeId/t/:terminalId`, `/git`, `/explorer`) and settings tabs (`/settings/general`, `/settings/network`) become nested routes. `TerminalWorkspace.vue` renders a `<RouterView />` in place of the `v-else-if` panel chain. `worktree-panels-storage.ts` is rewritten as a VueUse `useLocalStorage` composable with `activeTabId` removed.

**Tech Stack:** Vue 3, Vue Router 4, VueUse `useLocalStorage`, TanStack Vue Query, TypeScript

---

## File Map

| Action | File | Purpose |
|---|---|---|
| Create | `src/views/GeneralSettings.vue` | Terminal settings tab content |
| Create | `src/views/NetworkSettings.vue` | LAN/network settings tab content |
| Rewrite | `src/lib/worktree-panels-storage.ts` | VueUse composable, no `activeTabId` |
| Modify | `src/router/index.ts` | Nested routes + navigation guards |
| Modify | `src/views/SettingsView.vue` | RouterLink tab bar + `<RouterView>` |
| Modify | `src/components/TerminalWorkspace.vue` | Remove `activeId`/`syncActiveTab`, add `<RouterView>` |
| Modify | `src/components/GitPanel.vue` | Read/write `activeTab` via route query param |
| Delete | `src/components/Settings.vue` | Split into General + Network views |

---

## Task 1: Rewrite worktree-panels-storage.ts with VueUse

**Files:**
- Rewrite: `src/lib/worktree-panels-storage.ts`

- [ ] **Step 1: Replace the file contents**

```ts
import { useLocalStorage } from "@vueuse/core";
import { computed, type MaybeRefOrGetter, toValue } from "vue";
import type { ClientWorkspacePanel } from "@/types/workspace-panel";

export interface WorktreeAuxPanelsState {
  git: boolean;
  explorer: boolean;
}

const STORAGE_PREFIX = "lan-terminal:worktree-panels:";

export function gitPanelId(worktreeId: string): string {
  return `panel-git-${worktreeId}`;
}

export function explorerPanelId(worktreeId: string): string {
  return `panel-explorer-${worktreeId}`;
}

export function useWorktreePanels(worktreeId: MaybeRefOrGetter<string>) {
  const key = computed(() => `${STORAGE_PREFIX}${toValue(worktreeId)}`);
  return useLocalStorage<WorktreeAuxPanelsState>(key, { git: false, explorer: false });
}

export function clientPanelsFromState(
  worktreeId: string,
  state: WorktreeAuxPanelsState,
): ClientWorkspacePanel[] {
  const panels: ClientWorkspacePanel[] = [];
  if (state.git) {
    panels.push({ id: gitPanelId(worktreeId), type: "git", title: "Git" });
  }
  if (state.explorer) {
    panels.push({ id: explorerPanelId(worktreeId), type: "explorer", title: "Files" });
  }
  return panels;
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/blaisetiong/Developer/v2 && npx tsc --noEmit 2>&1 | head -30
```

Expected: errors only about removed exports (`loadAuxPanels`, `saveAuxPanels`, `auxPanelsStateFromClient`) being missing in `TerminalWorkspace.vue` — that's fine, we fix it in Task 5.

- [ ] **Step 3: Commit**

```bash
git add src/lib/worktree-panels-storage.ts
git commit -m "refactor: rewrite worktree-panels-storage with VueUse, remove activeTabId"
```

---

## Task 2: Create GeneralSettings.vue

**Files:**
- Create: `src/views/GeneralSettings.vue`

- [ ] **Step 1: Create the file**

```vue
<script setup lang="ts">
import TerminalSettingsCard from "@/components/TerminalSettingsCard.vue";
</script>

<template>
  <TerminalSettingsCard />
</template>
```

- [ ] **Step 2: Commit**

```bash
git add src/views/GeneralSettings.vue
git commit -m "feat: add GeneralSettings view"
```

---

## Task 3: Create NetworkSettings.vue

**Files:**
- Create: `src/views/NetworkSettings.vue`
- Source: copy all script + template from `src/components/Settings.vue` (minus the `<TerminalSettingsCard />` line)

- [ ] **Step 1: Create the file with the LAN content extracted from Settings.vue**

```vue
<script setup lang="ts">
import { computed, ref } from "vue";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import LanShareCard from "@/components/LanShareCard.vue";
import {
  useLanSettingsQuery,
  useRefreshInviteMutation,
  useSetLanMutation,
} from "@/api/settings";
import { ApiError } from "@/lib/api-error";

const { data, isPending } = useLanSettingsQuery();
const setLan = useSetLanMutation();
const refreshInvite = useRefreshInviteMutation();

const enabled = computed(() => data.value?.enabled ?? false);
const lanUrl = computed(() => data.value?.lanUrl);
const inviteExpiresAt = computed(() => data.value?.inviteExpiresAt);

const error = ref("");
const confirmEnable = ref(false);
const confirmDisable = ref(false);
const pendingEnable = ref<boolean | null>(null);

const loading = computed(
  () =>
    isPending.value ||
    setLan.isPending.value ||
    refreshInvite.isPending.value,
);

function mutationErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiError) return err.message;
  return fallback;
}

async function applyLan(next: boolean): Promise<void> {
  error.value = "";
  try {
    await setLan.mutateAsync(next);
  } catch (err) {
    error.value = mutationErrorMessage(err, "Failed to update LAN settings.");
  }
}

function onSwitchChange(checked: boolean) {
  if (loading.value) return;
  pendingEnable.value = checked;
  if (checked) {
    confirmEnable.value = true;
  } else {
    confirmDisable.value = true;
  }
}

async function confirmEnableAction() {
  confirmEnable.value = false;
  if (pendingEnable.value !== true) return;
  await applyLan(true);
  pendingEnable.value = null;
}

function cancelEnable() {
  confirmEnable.value = false;
  pendingEnable.value = null;
}

async function confirmDisableAction() {
  confirmDisable.value = false;
  if (pendingEnable.value !== false) return;
  await applyLan(false);
  pendingEnable.value = null;
}

function cancelDisable() {
  confirmDisable.value = false;
  pendingEnable.value = null;
}

async function onRefreshInvite() {
  error.value = "";
  try {
    await refreshInvite.mutateAsync();
  } catch (err) {
    error.value = mutationErrorMessage(err, "Failed to regenerate link.");
  }
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <Card>
      <CardHeader>
        <CardTitle>Network</CardTitle>
        <CardDescription>Control who can reach this terminal on your local network.</CardDescription>
      </CardHeader>
      <CardContent class="flex flex-col gap-4">
        <p v-if="error" class="text-sm text-destructive">{{ error }}</p>
        <div class="flex items-center justify-between gap-4">
          <Label>LAN access</Label>
          <Switch
            :checked="enabled"
            :disabled="loading"
            @update:checked="onSwitchChange"
          />
        </div>
      </CardContent>
    </Card>

    <LanShareCard
      v-if="enabled && lanUrl"
      :lan-url="lanUrl"
      :invite-expires-at="inviteExpiresAt"
      :loading="refreshInvite.isPending.value"
      @refresh="onRefreshInvite"
    />

    <AlertDialog :open="confirmEnable" @update:open="(v) => !v && cancelEnable()">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Enable LAN access?</AlertDialogTitle>
          <AlertDialogDescription>
            Anyone on your Wi‑Fi can reach this terminal. They still need the invite link or access token to sign in.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel @click="cancelEnable">Cancel</AlertDialogCancel>
          <AlertDialogAction @click="confirmEnableAction">Continue</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    <AlertDialog :open="confirmDisable" @update:open="(v) => !v && cancelDisable()">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Stop LAN access?</AlertDialogTitle>
          <AlertDialogDescription>
            Other devices will no longer be able to connect. Your localhost session continues.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel @click="cancelDisable">Cancel</AlertDialogCancel>
          <AlertDialogAction @click="confirmDisableAction">Stop</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>
</template>
```

- [ ] **Step 2: Commit**

```bash
git add src/views/NetworkSettings.vue
git commit -m "feat: add NetworkSettings view"
```

---

## Task 4: Update SettingsView.vue with tab bar + RouterView

**Files:**
- Modify: `src/views/SettingsView.vue`

- [ ] **Step 1: Replace SettingsView.vue**

```vue
<script setup lang="ts">
import { useRouter, useRoute, RouterView } from "vue-router";

const router = useRouter();
const route = useRoute();
</script>

<template>
  <div class="min-h-screen bg-background">
    <header class="flex items-center gap-3 border-b px-4 py-3">
      <button class="text-sm hover:underline" @click="router.back()">← Back</button>
      <h1 class="text-lg font-semibold">Settings</h1>
    </header>
    <main class="mx-auto max-w-lg p-4">
      <div class="flex gap-1 border-b mb-4">
        <button
          class="px-3 py-1.5 text-sm transition-colors"
          :class="route.name === 'settings-general'
            ? 'border-b-2 border-foreground font-medium text-foreground'
            : 'text-muted-foreground hover:text-foreground'"
          @click="router.push({ name: 'settings-general' })"
        >
          General
        </button>
        <button
          class="px-3 py-1.5 text-sm transition-colors"
          :class="route.name === 'settings-network'
            ? 'border-b-2 border-foreground font-medium text-foreground'
            : 'text-muted-foreground hover:text-foreground'"
          @click="router.push({ name: 'settings-network' })"
        >
          Network
        </button>
      </div>
      <RouterView />
    </main>
  </div>
</template>
```

- [ ] **Step 2: Delete Settings.vue**

```bash
rm /Users/blaisetiong/Developer/v2/src/components/Settings.vue
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /Users/blaisetiong/Developer/v2 && npx tsc --noEmit 2>&1 | head -30
```

Expected: errors only in `TerminalWorkspace.vue` (still uses old storage API) — not in settings files.

- [ ] **Step 4: Commit**

```bash
git add src/views/SettingsView.vue src/components/Settings.vue
git commit -m "feat: add settings tab bar with RouterView, delete Settings.vue"
```

---

## Task 5: Add nested routes + guards to router/index.ts

**Files:**
- Modify: `src/router/index.ts`

- [ ] **Step 1: Replace the full router file**

```ts
import { createRouter, createWebHistory } from "vue-router";
import LoginView from "@/views/LoginView.vue";
import WorkspaceView from "@/views/WorkspaceView.vue";
import SettingsView from "@/views/SettingsView.vue";
import GeneralSettings from "@/views/GeneralSettings.vue";
import NetworkSettings from "@/views/NetworkSettings.vue";
import Terminal from "@/components/Terminal.vue";
import GitPanel from "@/components/GitPanel.vue";
import FileExplorerPanel from "@/components/FileExplorerPanel.vue";
import { ensureLocalAuth } from "@/api/auth";
import { lanSettingsQueryOptions } from "@/api/settings";
import { queryClient } from "@/lib/query-client";
import { ApiError } from "@/lib/api-error";
import { isLocalHost } from "@/lib/is-local-host";
import { workspaceKeys } from "@/api/workspace";
import { apiClient } from "@/lib/api-client";
import { ensureOk } from "@/lib/api-error";
import type { TerminalTab } from "@/api/workspace";

const VALID_GIT_TABS = ["staged", "unstaged", "untracked"] as const;

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: "/login",
      name: "login",
      component: LoginView,
      meta: { public: true },
    },
    {
      path: "/",
      name: "home",
      component: WorkspaceView,
    },
    {
      path: "/w/:worktreeId",
      name: "workspace",
      component: WorkspaceView,
      beforeEnter: async (to) => {
        if (to.name === "workspace") {
          const worktreeId = to.params.worktreeId as string;
          try {
            const terminals = await queryClient.ensureQueryData<TerminalTab[]>({
              queryKey: workspaceKeys.terminals(worktreeId),
              queryFn: async () => {
                const res = await apiClient.worktrees[":id"].terminals.$get({
                  param: { id: worktreeId },
                });
                const data = await ensureOk<{ terminals: TerminalTab[] }>(res);
                return data.terminals;
              },
            });
            if (terminals.length > 0) {
              return {
                name: "terminal",
                params: { worktreeId, terminalId: terminals[0].id },
              };
            }
          } catch {
            // No terminals — stay on workspace, show empty state
          }
        }
      },
      children: [
        {
          path: "t/:terminalId",
          name: "terminal",
          component: Terminal,
          props: (route) => ({ sessionId: route.params.terminalId }),
        },
        {
          path: "git",
          name: "git",
          component: GitPanel,
          props: (route) => ({ worktreeId: route.params.worktreeId }),
          beforeEnter: (to) => {
            if (!VALID_GIT_TABS.includes(to.query.tab as typeof VALID_GIT_TABS[number])) {
              return { ...to, query: { tab: "staged" } };
            }
          },
        },
        {
          path: "explorer",
          name: "explorer",
          component: FileExplorerPanel,
          props: (route) => ({ worktreeId: route.params.worktreeId }),
        },
      ],
    },
    {
      path: "/settings",
      name: "settings",
      component: SettingsView,
      redirect: { name: "settings-general" },
      children: [
        { path: "general", name: "settings-general", component: GeneralSettings },
        { path: "network", name: "settings-network", component: NetworkSettings },
      ],
    },
  ],
});

router.beforeEach(async (to) => {
  if (to.meta.public) {
    if (to.name === "login" && isLocalHost()) {
      await ensureLocalAuth();
      return { name: "home" };
    }
    return true;
  }

  if (isLocalHost()) {
    try {
      await ensureLocalAuth();
      await queryClient.ensureQueryData(lanSettingsQueryOptions());
      return true;
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        return { name: "login", query: to.query };
      }
      throw err;
    }
  }

  try {
    await queryClient.ensureQueryData(lanSettingsQueryOptions());
    return true;
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      return { name: "login", query: to.query };
    }
    throw err;
  }
});

export default router;
```

- [ ] **Step 2: Check TerminalTab is exported from workspace API**

```bash
grep "export.*TerminalTab" /Users/blaisetiong/Developer/v2/src/api/workspace.ts
```

Expected: `export interface TerminalTab {` or `export type TerminalTab`. If not found, add `export` to the `TerminalTab` interface in `src/api/workspace.ts`.

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /Users/blaisetiong/Developer/v2 && npx tsc --noEmit 2>&1 | head -40
```

Expected: errors only in `TerminalWorkspace.vue` (still uses old storage API).

- [ ] **Step 4: Commit**

```bash
git add src/router/index.ts
git commit -m "feat: add nested routes for workspace panels and settings tabs"
```

---

## Task 6: Update GitPanel.vue to read/write activeTab via route query

**Files:**
- Modify: `src/components/GitPanel.vue`

The current `const activeTab = ref<TabScope>("unstaged")` becomes a writable computed that reads from `route.query.tab` and writes back via `router.replace`.

- [ ] **Step 1: Add router imports to the script setup block**

In `src/components/GitPanel.vue`, replace:
```ts
import { computed, ref } from "vue";
```
with:
```ts
import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";
```

- [ ] **Step 2: Replace the activeTab ref with a writable computed**

Remove:
```ts
const activeTab = ref<TabScope>("unstaged");
```

Add after the `props` definition:
```ts
const route = useRoute();
const router = useRouter();

const activeTab = computed<TabScope>({
  get: () => (route.query.tab as TabScope) ?? "staged",
  set: (val: TabScope) => {
    router.replace({ query: { tab: val } });
  },
});
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /Users/blaisetiong/Developer/v2 && npx tsc --noEmit 2>&1 | head -40
```

Expected: errors only in `TerminalWorkspace.vue`.

- [ ] **Step 4: Commit**

```bash
git add src/components/GitPanel.vue
git commit -m "feat: wire GitPanel activeTab to route query param"
```

---

## Task 7: Refactor TerminalWorkspace.vue to use router

**Files:**
- Modify: `src/components/TerminalWorkspace.vue`

This is the largest change. We remove `activeId`, `syncActiveTab`, `activePanelType`, `persistPanelState`, `restoreClientPanels`, and the `v-else-if` panel chain. We add `<RouterView>`, `useRoute`/`useRouter`, and `useWorktreePanels`.

- [ ] **Step 1: Replace the full script setup block**

Replace the entire `<script setup lang="ts">` block with:

```vue
<script setup lang="ts">
import { computed, provide, watch } from "vue";
import {
  FolderTreeIcon,
  GitBranchIcon,
  TerminalIcon,
  XIcon,
} from "@lucide/vue";
import { RouterView, useRoute, useRouter } from "vue-router";
import WorkspacePanelMenu from "@/components/WorkspacePanelMenu.vue";
import WorkspaceSidebarToggle from "@/components/WorkspaceSidebarToggle.vue";
import TerminalResumeDialog from "@/components/TerminalResumeDialog.vue";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { cn } from "@/lib/utils";
import {
  createTerminalSessionsStore,
  terminalSessionsKey,
} from "@/composables/terminal-sessions";
import {
  useCreateTerminalMutation,
  useDeleteTerminalMutation,
  useTerminalsQuery,
} from "@/api/workspace";
import {
  useWorktreePanels,
  clientPanelsFromState,
  gitPanelId,
  explorerPanelId,
} from "@/lib/worktree-panels-storage";
import type { WorkspacePanelType } from "@/types/workspace-panel";

const props = defineProps<{
  worktreeId: string;
}>();

const route = useRoute();
const router = useRouter();
const sessions = createTerminalSessionsStore();
provide(terminalSessionsKey, sessions);

const panelsState = useWorktreePanels(() => props.worktreeId);

const { data: terminals, isLoading } = useTerminalsQuery(
  () => props.worktreeId,
);
const createTerminal = useCreateTerminalMutation(() => props.worktreeId);
const deleteTerminal = useDeleteTerminalMutation(() => props.worktreeId);

const terminalTabs = computed(() => terminals.value ?? []);

const clientPanels = computed(() =>
  clientPanelsFromState(props.worktreeId, panelsState.value),
);

const allTabs = computed(() => [
  ...terminalTabs.value.map((t) => ({
    id: t.id,
    type: "terminal" as const,
    title: sessions.tabLabel(t.id),
  })),
  ...clientPanels.value.map((p) => ({
    id: p.id,
    type: p.type as WorkspacePanelType,
    title: p.title,
  })),
]);

const activeId = computed(() => {
  if (route.name === "terminal") return route.params.terminalId as string;
  if (route.name === "git") return gitPanelId(props.worktreeId);
  if (route.name === "explorer") return explorerPanelId(props.worktreeId);
  return "";
});

const resumeDialogOpen = ref(false);
const resumeDialogTerminalId = ref("");

// Create sessions for loaded terminals
watch(
  terminals,
  (list) => {
    if (!list) return;
    for (const t of list) {
      if (!sessions.get(t.id)) {
        sessions.create({ id: t.id, terminalId: t.id, title: t.title });
      }
    }
  },
  { immediate: true },
);

// Redirect if current terminal no longer exists
watch(
  [terminals, () => route.params.terminalId],
  ([list, terminalId]) => {
    if (!list || route.name !== "terminal") return;
    if (terminalId && !list.some((t) => t.id === terminalId)) {
      const first = list[0];
      if (first) {
        router.replace({
          name: "terminal",
          params: { worktreeId: props.worktreeId, terminalId: first.id },
        });
      }
    }
  },
);

function navigateTo(tab: { id: string; type: WorkspacePanelType }) {
  if (tab.type === "terminal") {
    router.push({ name: "terminal", params: { worktreeId: props.worktreeId, terminalId: tab.id } });
  } else if (tab.type === "git") {
    router.push({ name: "git", params: { worktreeId: props.worktreeId } });
  } else if (tab.type === "explorer") {
    router.push({ name: "explorer", params: { worktreeId: props.worktreeId } });
  }
}

async function addPanel(type: WorkspacePanelType) {
  if (type === "terminal") {
    const terminal = await createTerminal.mutateAsync(undefined);
    sessions.create({ id: terminal.id, terminalId: terminal.id, title: terminal.title });
    router.push({ name: "terminal", params: { worktreeId: props.worktreeId, terminalId: terminal.id } });
    return;
  }
  if (type === "git") {
    panelsState.value.git = true;
    router.push({ name: "git", params: { worktreeId: props.worktreeId } });
    return;
  }
  if (type === "explorer") {
    panelsState.value.explorer = true;
    router.push({ name: "explorer", params: { worktreeId: props.worktreeId } });
  }
}

async function closeTab(id: string) {
  const isActive = id === activeId.value;
  const remaining = allTabs.value.filter((t) => t.id !== id);

  const clientPanel = clientPanels.value.find((p) => p.id === id);
  if (clientPanel) {
    if (clientPanel.type === "git") panelsState.value.git = false;
    else if (clientPanel.type === "explorer") panelsState.value.explorer = false;
  } else {
    await deleteTerminal.mutateAsync(id);
    sessions.remove(id);
  }

  if (isActive && remaining[0]) {
    navigateTo(remaining[0] as { id: string; type: WorkspacePanelType });
  }
}

function tabIcon(type: WorkspacePanelType) {
  if (type === "git") return GitBranchIcon;
  if (type === "explorer") return FolderTreeIcon;
  return TerminalIcon;
}

function tabTriggerClass(tabId: string, index: number) {
  const isActive = tabId === activeId.value;
  return cn(
    "group relative inline-flex h-8 max-w-56 shrink-0 items-center gap-1.5 rounded-none px-2.5 text-[0.8125rem] font-normal leading-none transition-colors focus-visible:outline-1 focus-visible:outline-offset-[-1px] focus-visible:outline-ring",
    isActive
      ? cn(
          "z-10 -mb-px border-x bg-background text-foreground",
          index === 0 && "border-l-0",
        )
      : "bg-transparent text-muted-foreground",
  );
}

function tabCloseClass(tabId: string) {
  const isActive = tabId === activeId.value;
  return cn(
    "ml-0.5 shrink-0 rounded-sm p-0.5 opacity-0 transition-opacity hover:bg-foreground/10 hover:opacity-100",
    isActive ? "opacity-50" : "group-hover:opacity-50",
  );
}

function tabTitle(tab: { id: string; type: WorkspacePanelType; title: string }) {
  if (tab.type === "terminal") {
    return sessions.tabCwd(tab.id) ?? sessions.tabLabel(tab.id);
  }
  return tab.title;
}

function terminalRow(id: string) {
  return terminalTabs.value.find((t) => t.id === id);
}

function openResumeDialog(terminalId: string) {
  resumeDialogTerminalId.value = terminalId;
  resumeDialogOpen.value = true;
}
</script>
```

Note: `ref` must be added to the `import { computed, provide, watch }` line — change it to `import { computed, provide, ref, watch }`.

- [ ] **Step 2: Replace the template content area**

In the template, find the content area block:

```vue
<Terminal
  v-else-if="activeId && activePanelType === 'terminal'"
  :session-id="activeId"
  class="absolute inset-0"
/>
<GitPanel
  v-else-if="activeId && activePanelType === 'git'"
  :worktree-id="worktreeId"
  class="absolute inset-0"
/>
<FileExplorerPanel
  v-else-if="activeId && activePanelType === 'explorer'"
  :worktree-id="worktreeId"
  class="absolute inset-0"
/>
```

Replace with:

```vue
<RouterView class="absolute inset-0" />
```

- [ ] **Step 3: Remove Terminal, GitPanel, FileExplorerPanel imports from TerminalWorkspace.vue**

These components are now rendered by the router, not imported directly. Remove their import lines from the script setup.

- [ ] **Step 4: Verify TypeScript compiles with no errors**

```bash
cd /Users/blaisetiong/Developer/v2 && npx tsc --noEmit 2>&1 | head -40
```

Expected: clean output (no errors).

- [ ] **Step 5: Start the dev server and manually verify**

```bash
cd /Users/blaisetiong/Developer/v2 && npm run dev
```

Verify:
1. Navigating to `/` redirects to `/w/:worktreeId/t/:terminalId` (first terminal)
2. Clicking a terminal tab updates the URL
3. Clicking the Git tab navigates to `/w/:worktreeId/git?tab=staged`
4. Switching git tabs (Staged/Unstaged/Untracked) updates `?tab=` in the URL
5. Clicking the Explorer tab navigates to `/w/:worktreeId/explorer`
6. Closing a tab navigates to the next available tab
7. Navigating to `/settings` redirects to `/settings/general`
8. Clicking Network tab navigates to `/settings/network`
9. Settings back button returns to previous page (workspace)
10. Browser back/forward button works across tab changes

- [ ] **Step 6: Commit**

```bash
git add src/components/TerminalWorkspace.vue
git commit -m "feat: refactor TerminalWorkspace to use Vue Router, replace activeId with route params"
```

---

## Self-Review Notes

- `TerminalTab` must be exported from `src/api/workspace.ts` for router import (Task 5, Step 2 checks this)
- `ref` must be included in Vue imports in `TerminalWorkspace.vue` (noted in Task 7, Step 1)
- `WorkspaceView.vue` is unchanged — its `router.replace({ name: "workspace", ... })` navigates to the parent, which the `beforeEnter` guard redirects to the first terminal. Correct behavior.
- `worktree-panels-storage.ts` no longer exports `loadAuxPanels`, `saveAuxPanels`, or `auxPanelsStateFromClient`. Any other files importing these would break — but only `TerminalWorkspace.vue` imported them (confirmed from audit).
