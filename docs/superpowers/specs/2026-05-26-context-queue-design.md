# Context Queue Design

**Date:** 2026-05-26  
**Status:** Draft (pending user review)

## Overview

Add a **context queue** — a worktree-scoped scratch buffer in the top-right of the workspace header. Users append highlighted code (and optional file references) from Git and Files panels, compose a note in one textarea, then **explicitly** send the combined block to the active terminal prompt for an agent or shell to read.

Nothing is pasted into the terminal until the user clicks **Send** (or confirms with a shortcut inside the popover). **`Ctrl+L`** appends on Git/Files; on the terminal tab, **`Ctrl+L`** only opens the queue popover (does not append, avoiding conflict with the terminal’s clear-screen binding).

---

## Goals

- Collect multiple snippets and file paths while reviewing diffs or file tabs.
- Prefix each append with `# relative/path` plus selection text (format B).
- Paste the full queue to the terminal prompt in one action when ready.
- Stay on Git/Files while building the queue; sending does not require switching tabs.

## Non-goals (v1)

- Auto-send on append or panel change.
- Line-number metadata in appends (selection text only).
- Server-side persistence or sync across devices.
- Replacing git stage/unstage checkboxes.

---

## User flows

### Append from Git or Files

1. User selects text in a Pierre `CodeView` (diff or file preview), or focuses a file context with no selection.
2. User presses **`Ctrl+L`**.
3. App resolves a **worktree-relative path** and appends to the queue:

   ```text
   # src/foo.ts
   selected lines here


   ```

   - With selection: `# path`, newline, selection, then `\n\n` before the next block.
   - Without selection: `# path` only, then `\n\n`.
4. Queue popover may open briefly or stay open if already visible; queue text updates immediately.

### Open queue from terminal

1. User is on a terminal tab and presses **`Ctrl+L`**.
2. Queue popover opens/focuses. **No append** (preserves terminal clear-screen behavior).

### Send to terminal

1. User opens the queue (header button or **`Ctrl+L`** on terminal).
2. User edits the textarea if needed (free-form notes between blocks).
3. User clicks **Send to terminal** (or **`Ctrl+Enter`** while focus is in the queue textarea).
4. App calls `sendInput` on the resolved target terminal with queue text + trailing newline.
5. Optional (default on): clear queue after successful send. Optional (default off): focus terminal after send.

---

## UI

### Placement

- **`ContextQueueTrigger`** in `TerminalWorkspace.vue` header, top-right cluster (before or after Git/Files icon buttons).
- Popover anchored to the trigger; wide enough for ~80 columns of monospace preview (`sm:max-w-lg`).

### Popover contents

| Control | Behavior |
|---------|----------|
| Textarea | Editable queue body; persisted per worktree |
| **Send to terminal** | Primary; disabled when empty or no terminal exists |
| **Clear** | Wipes queue and storage |
| Footer hint | `Ctrl+L` append (Git/Files) · `Ctrl+Enter` send |

### Feedback

- Toast on send success.
- Toast when append cannot resolve a path (“path unknown” — append selection only or skip per implementation choice: **append selection only** with warning).
- Toast when send attempted with no terminal (“Open a terminal first”).

---

## Keyboard shortcuts

New keybinding actions (added to `KEYBINDING_ACTIONS`, defaults, Settings descriptors):

| Action | Default | When active |
|--------|---------|-------------|
| `contextQueue.append` | `Ctrl+l` | Routes `git`, `explorer` only; not in native inputs |
| `contextQueue.open` | *(same chord, route dispatch)* | Route `terminal` — open popover only |

**Implementation note:** A single `keydown` handler in the workspace shell inspects `route.name`:

- `terminal` → open popover (`contextQueue.open` behavior).
- `git` \| `explorer` → append (`contextQueue.append` behavior).

Both map to `Ctrl+l` in defaults; Settings shows one row per action or one row with a description of route-dependent behavior (prefer **two actions** sharing the same default chord so users can rebind independently later).

**Input guard:** Skip when `event.target` is `<input>`, `<textarea>`, or `[contenteditable]` (commit message, queue textarea, etc.).

**`Ctrl+Enter` in popover:** Not a global keybinding; handled on the queue textarea to send.

---

## Append payload format

```ts
function formatQueueAppend({
  relativePath,
  selection,
}: {
  relativePath: string;
  selection?: string;
}): string
```

- Always emit `# ${relativePath}\n`.
- If `selection.trim()`: append selection + `\n`.
- Terminate block with `\n` (second newline separates blocks).

**Path resolution**

| Panel | Path source (priority) |
|-------|-------------------------|
| Explorer | Active file tab (`route.query.file` → relative path) |
| Git | Text selection anchor → Pierre `diffs-container` host → `item.id` (file path); fallback: single checked path in `selectedPaths`; fallback: single diff item in view |

**Future v1.1 (optional buttons in popover, not required for v1):**

- “Add checked git files” → one `# path` line per path in `selectedPaths`.
- “Add current file” → `# path` for active explorer tab.

---

## Send to terminal

Reuse existing session plumbing:

1. Resolve terminal id: `sessions.activeId` if valid → `panelsState.lastTerminalId` → first terminal in worktree.
2. `sessions.get(id)?.sendInput(queueText.endsWith('\n') ? queueText : queueText + '\n')`.
3. Do not navigate away from the current panel unless “Focus terminal after send” is enabled.

No new WebSocket protocol.

---

## State & modules

### Storage

- Key: `lan-terminal:context-queue:{worktreeId}`
- Shape: `{ text: string }`
- Via `useLocalStorage` (same pattern as `useGitPanelStorage`).

### Client modules

| File | Responsibility |
|------|----------------|
| `src/modules/context-queue/lib/context-queue-storage.ts` | Persist queue text |
| `src/modules/context-queue/lib/format-queue-append.ts` | Format `# path` blocks; unit tests |
| `src/modules/context-queue/lib/resolve-code-context.ts` | Path + selection from DOM/route/git state |
| `src/modules/context-queue/hooks/use-context-queue.ts` | append, clear, send, open state |
| `src/modules/context-queue/components/ContextQueuePopover.vue` | Popover UI |
| `src/modules/context-queue/hooks/use-context-queue-keybinding.ts` | `Ctrl+L` route dispatch |

### Integration points

- `TerminalWorkspace.vue` — mount trigger + popover; register keybinding hook.
- `useGlobalWorkspaceKeybindings` or dedicated hook — avoid duplicate listeners; prefer **one** workspace-level listener that delegates to context queue when chord matches.
- `server/schemas/api.ts` + `KEYBINDING_OPTIONS` + `KEYBINDING_DESCRIPTORS` — new actions.

---

## Error handling

| Case | Behavior |
|------|----------|
| Empty queue + Send | Button disabled |
| No terminals | Send disabled; toast on forced send |
| Append with no path | Toast warning; append selection only (no `#` line) |
| `sendInput` while WS closed | Toast error; keep queue text |
| Very large queue | No hard limit v1; textarea scrolls |

---

## Testing

- **Unit:** `format-queue-append` (path only, path + selection, separators).
- **Unit:** `resolve-code-context` with mocked DOM hosts / route params.
- **Manual:** Append from git diff, file preview, multiple blocks, send on terminal tab without switching, `Ctrl+L` on terminal opens popover without clearing screen.

---

## Decisions log

| Decision | Choice |
|----------|--------|
| Send timing | Explicit only (button / `Ctrl+Enter` in popover) |
| Append format | `# relative/path` + selection (format B) |
| Append chord | `Ctrl+l` on Git/Files |
| Terminal + `Ctrl+l` | Open popover only (B) |
| Target terminal | Last/active/first; no tab picker v1 |
| Persistence | Per-worktree `localStorage` |

---

## File list (implementation)

**New**

- `src/modules/context-queue/**` (as above)
- `docs/superpowers/specs/2026-05-26-context-queue-design.md` (this file)

**Modified**

- `src/modules/terminal/layout/TerminalWorkspace.vue`
- `src/modules/keyboard/types.ts` (descriptors)
- `src/modules/keyboard/options.ts` (defaults)
- `server/schemas/api.ts` (`KEYBINDING_ACTIONS`)
- `src/modules/settings/pages/KeybindingsSettings.vue` (labels for new actions)
