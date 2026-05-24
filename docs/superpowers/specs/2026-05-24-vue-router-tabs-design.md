# Vue Router Tabs & Settings Design

**Date:** 2026-05-24  
**Status:** Approved

## Overview

Migrate workspace panel tabs and the settings page to full Vue Router nested routes. Active tab state moves from a manual `activeId` ref + localStorage sync into the URL, giving users deep-linkable tabs, working browser back/forward, and simpler component logic.

---

## Route Structure

```
/login
/
/w/:worktreeId                         WorkspaceView (guard → redirect to first terminal)
  /w/:worktreeId/t/:terminalId         Terminal panel
  /w/:worktreeId/git                   Git panel (guard → default ?tab=staged)
  /w/:worktreeId/git?tab=staged
  /w/:worktreeId/git?tab=unstaged
  /w/:worktreeId/git?tab=untracked
  /w/:worktreeId/explorer              File explorer panel
/settings                              SettingsView (static redirect → /settings/general)
  /settings/general                    GeneralSettings
  /settings/network                    NetworkSettings
```

---

## Section 1 — Workspace Tab Routing

### What is deleted

| Removed | Replaced by |
|---|---|
| `activeId` ref | `useRoute().params.terminalId` / matched route path |
| `syncActiveTab()` | `beforeEnter` guard on `/w/:worktreeId` |
| `activePanelType` computed | Implicit from matched child route |
| `v-else-if` panel chain | `<RouterView>` |

### What is kept

- `clientPanels` ref + localStorage — still tracks *which* client panels (git, explorer) appear in the tab bar (open/closed state). Active state is no longer stored here.
- `createTerminal` / `deleteTerminal` mutations — unchanged.
- `terminalSessionsKey` / session store — unchanged.

### Tab interaction changes

- Clicking a tab → `router.push('/w/:worktreeId/t/:terminalId')` etc.
- `addPanel(type)` → `router.push(panelRoute(type))`
- `closeTab(id)` → navigate to next available tab, then update `clientPanels`

### Content area

`TerminalWorkspace.vue` content area becomes:

```vue
<RouterView class="absolute inset-0" />
```

`Terminal`, `GitPanel`, and `FileExplorerPanel` become child route components, each receiving props via `route.params` / `route.query`.

---

## Section 2 — Settings Tabs

### File changes

| File | Change |
|---|---|
| `Settings.vue` | Deleted |
| `GeneralSettings.vue` | New — contains `TerminalSettingsCard` |
| `NetworkSettings.vue` | New — contains LAN card + alert dialogs + all LAN logic |
| `SettingsView.vue` | Gains tab bar (`RouterLink` tabs) + `<RouterView>` |

### Tab bar

Uses existing `Tabs` / `TabsList` / `TabsTrigger` UI components. Each trigger is a `RouterLink` to `/settings/general` or `/settings/network`. Active state is driven by `route.path` match, not a local ref.

---

## Section 3 — Navigation Guards

### Workspace guard (`beforeEnter` on `/w/:worktreeId`)

```
1. Call queryClient.ensureQueryData(terminalsQueryOptions(worktreeId))
2. If terminals exist → redirect to /w/:worktreeId/t/:firstTerminalId
3. If no terminals → render empty state (no redirect)
```

Consistent with existing auth guards that already use `queryClient.ensureQueryData`.

### Git tab guard (`beforeEnter` on `/w/:worktreeId/git`)

```
1. Read route.query.tab
2. If missing or not in ['staged', 'unstaged', 'untracked'] → redirect with ?tab=staged
3. Otherwise → proceed
```

### Settings redirect

Static route config — no guard needed:

```ts
{ path: '/settings', redirect: '/settings/general' }
```

### Existing guards

`router.beforeEach` (auth + LAN check) is untouched.

---

## Out of Scope

- No changes to terminal session store, PTY registry, or agent logic
- No changes to WorkspaceSidebar or worktree switching
- No lazy-loading / code splitting (can be added later)
