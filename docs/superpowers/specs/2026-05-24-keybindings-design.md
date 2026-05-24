# Keybindings Module Design

**Date:** 2026-05-24  
**Status:** Approved

## Overview

Add a configurable keyboard shortcut system to the LAN Terminal app. Shortcuts are stored in a JSON file on disk, with a Settings UI to edit them. The defaults cover the four requested bindings; the system is extensible.

---

## 1. Config File

**Location:** `~/.workbench/keybindings.json`

Stored in the user's home directory so it survives app reinstalls and is shared across worktrees. The file only needs to contain overrides — missing keys fall back to defaults.

**Format:**
```json
{
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
  "terminal.tab.9": "Meta+9"
}
```

**Supported modifiers:** `Meta` (⌘ on Mac), `Ctrl`, `Shift`, `Alt`.  
**Key chord format:** `"Modifier+key"` — modifiers joined with `+`, key is the `event.key` value (e.g. `n`, `1`, `e`).  
**Validation:** The server validates that each value matches the chord pattern before writing. Invalid chords are rejected with a 400.

---

## 2. Server API

Two new Hono route handlers added to the existing server, following the same pattern as other API modules.

### `GET /api/keybindings`
- Reads `~/.workbench/keybindings.json`. If the file does not exist, returns the defaults.
- Merges the file contents over the defaults (file values win).
- Returns the full resolved map as JSON.

### `PUT /api/keybindings`
- Accepts the full keybindings map as the request body.
- Validates each value matches the chord format regex.
- Writes `~/.workbench/keybindings.json` (creates the directory if needed).
- Returns the written map.

No authentication beyond the existing `ensureLocalAuth` middleware.

---

## 3. Client Module — `src/modules/keyboard/`

### `types.ts`
```ts
export type KeybindingAction =
  | "terminal.newTerminal"
  | "panel.explorer"
  | "panel.git"
  | `terminal.tab.${1|2|3|4|5|6|7|8|9}`;

export type KeybindingsMap = Record<KeybindingAction, string>;
```

### `defaults.ts`
Exports `DEFAULT_KEYBINDINGS: KeybindingsMap` with the values shown in the config example above.

### `queries/keybindings.ts`
- `keybindingsQueryOptions()` — fetches `GET /api/keybindings`, cache key `["keybindings"]`
- `useUpdateKeybindingsMutation()` — calls `PUT /api/keybindings`, invalidates the query on success

### `hooks/useWorkspaceKeybindings.ts`
Composable called from `TerminalWorkspace.vue`. Receives:
- `terminalTabItems` — `ComputedRef<{ id: string }[]>`
- `navigateToTerminal(id: string)` 
- `addTerminal()`
- `worktreeId` — `MaybeRefOrGetter<string>`
- `router`

Fetches the resolved bindings via TanStack Query. Attaches a single `keydown` listener on `window` using `useEventListener` from `@vueuse/core` (auto-cleans up on unmount). On each keydown:

1. Build a chord string from the event (e.g. `"Meta+n"`).
2. Match against the resolved bindings map.
3. Dispatch the corresponding action:
   - `terminal.newTerminal` → `addTerminal()`
   - `panel.explorer` → `router.push({ name: 'explorer', params: { worktreeId } })`  + sets `panelsState.explorer = true`
   - `panel.git` → `router.push({ name: 'git', params: { worktreeId } })` + sets `panelsState.git = true`
   - `terminal.tab.N` → `navigateToTerminal(terminalTabItems[N-1]?.id)` if that tab exists
4. If a binding matched, call `event.preventDefault()`.

**Cmd+E / Cmd+G behavior:** Always opens/focuses — does not toggle closed.

**Input guard:** Skip handling when the active element is an `<input>`, `<textarea>`, or `[contenteditable]` to avoid clobbering terminal input. Exception: the terminal xterm canvas is not a native input element, so shortcuts remain active while a terminal is focused.

---

## 4. Settings UI

### Route
New child route under `/settings`:
- Path: `keybindings`
- Name: `settings-keybindings`
- Component: `KeybindingsSettings.vue`

Added to the Settings tab bar alongside General and Network.

### `KeybindingsSettings.vue`

A table with three columns: **Action**, **Description**, **Shortcut**.

| Action | Description | Shortcut |
|--------|-------------|----------|
| New terminal | Open a new terminal tab | ⌘N |
| File explorer | Open the file explorer panel | ⌘E |
| Git | Open the git panel | ⌘G |
| Switch to tab 1–9 | Navigate to terminal tab by number | ⌘1 – ⌘9 |

**Editing flow:**
1. User clicks a shortcut cell → cell enters capture mode, shows "Press keys…"
2. The next `keydown` event (excluding bare modifiers) is captured and displayed.
3. User confirms or cancels. On confirm, the new chord is written to local state.
4. A "Save" button at the top calls `PUT /api/keybindings` with the full updated map and invalidates the query.
5. A "Reset to defaults" button restores `DEFAULT_KEYBINDINGS` and saves.

**Conflict detection:** If the entered chord is already assigned to another action, show an inline warning but still allow saving (user's choice).

---

## 5. File List

**New files:**
- `src/modules/keyboard/types.ts`
- `src/modules/keyboard/defaults.ts`
- `src/modules/keyboard/queries/keybindings.ts`
- `src/modules/keyboard/hooks/useWorkspaceKeybindings.ts`
- `src/modules/settings/pages/KeybindingsSettings.vue`
- `server/routes/keybindings.ts`

**Modified files:**
- `server/index.ts` — register keybindings routes
- `src/router/index.ts` — add `settings-keybindings` child route
- `src/modules/settings/layout/SettingsView.vue` — add Keybindings tab
- `src/modules/terminal/layout/TerminalWorkspace.vue` — call `useWorkspaceKeybindings`
