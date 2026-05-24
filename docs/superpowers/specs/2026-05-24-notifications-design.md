# Notifications System Design

**Date:** 2026-05-24  
**Status:** Approved

---

## Overview

A global notification module backed by SQLite. Any project or worktree in the app can push a notification. Notifications surface as unread badges in the sidebar and as a dismissible panel. The system also integrates with Claude Code hooks so agents can trigger notifications when they stop or complete tasks.

---

## Architecture

```
Claude Code hook → ~/.claude/hooks/workbench-notify.sh
  → workbench notify (native desktop alert)
  → POST /notifications (stored in SQLite)

Internal app event → POST /notifications → SQLite

Frontend (5s poll) → GET /notifications
  → unread badges on worktree sidebar items
  → NotificationPanel (⌘⇧I)
```

---

## 1. Backend — SQLite Schema

Table: `notifications`

| Column | Type | Notes |
|--------|------|-------|
| `id` | TEXT PK | UUID |
| `worktree_id` | TEXT NULL | FK to worktrees; null = app-level |
| `title` | TEXT | Required |
| `subtitle` | TEXT NULL | Optional |
| `body` | TEXT | Required |
| `read` | INTEGER | 0 = unread, 1 = read |
| `created_at` | TEXT | ISO 8601 |

---

## 2. Backend — REST Endpoints

| Method | Path | Body / Notes |
|--------|------|--------------|
| `GET` | `/notifications` | Returns all, sorted newest-first |
| `POST` | `/notifications` | `{ worktreeId?, title, subtitle?, body }` |
| `PATCH` | `/notifications/:id/read` | Marks one notification read |
| `POST` | `/notifications/read-all` | Marks all notifications read |
| `DELETE` | `/notifications/:id` | Removes one notification |

---

## 3. Frontend — Types

**`src/types/notification.ts`**

```ts
export interface Notification {
  id: string;
  worktreeId: string | null;
  title: string;
  subtitle: string | null;
  body: string;
  read: boolean;
  createdAt: string;
}
```

---

## 4. Frontend — API Composable

**`src/api/notifications.ts`** — follows the exact same pattern as `workspace.ts`.

- `notificationKeys` — query key factory
- `notificationsQueryOptions()` — `refetchInterval: 5_000`
- `useNotificationsQuery()`
- `useMarkReadMutation(id)`
- `useMarkAllReadMutation()`
- `useClearNotificationMutation(id)`
- `useSendNotificationMutation()` — for internal pushes from any component

---

## 5. Frontend — Global Store

**`src/composables/notifications.ts`**

Provided at `App.vue` level via Vue `provide/inject` (same pattern as `workspaceSidebarKey`).

Exports:
- `unreadCount: ComputedRef<number>` — derived from query data
- `unreadByWorktree: ComputedRef<Record<string, number>>` — per-worktree unread count
- `push(worktreeId: string | null, title: string, body: string, subtitle?: string): Promise<void>` — any component calls this without touching the API directly

Injection key: `notificationsKey` exported from the composable.

---

## 6. UI Components

### NotificationPanel.vue

- Sheet/drawer anchored to the right
- Lists notifications newest-first
- Each item shows: title, subtitle, body, relative timestamp, worktree name
- Clicking an item navigates to that worktree (`router.push`) and marks it read
- "Mark all read" button at the top
- Individual clear (×) button per notification
- Toggled by ⌘⇧I keyboard shortcut (wired in `App.vue`)
- Panel open state is tracked globally; while open, desktop alerts are considered suppressed

### WorkspaceSidebar.vue — unread badges

- Use existing `SidebarMenuBadge` component
- Show unread count dot on worktree list items when `unreadByWorktree[worktree.id] > 0`
- Badge disappears when the worktree is visited (auto mark-read on route enter)

---

## 7. Claude Code Hooks Integration

### Hook script

**`~/.claude/hooks/workbench-notify.sh`**

```sh
#!/bin/sh
# Fire a desktop alert via workbench and record in the app
TITLE="${CLAUDE_HOOK_EVENT:-Claude Code}"
BODY="${CLAUDE_NOTIFICATION_BODY:-Done}"

# Native workbench desktop notification
if command -v workbench &>/dev/null; then
  workbench notify --title "$TITLE" --body "$BODY"
fi

# Record in the app (local server)
curl -s -X POST http://localhost:PORT/notifications \
  -H "Content-Type: application/json" \
  -d "{\"title\":\"$TITLE\",\"body\":\"$BODY\"}" > /dev/null 2>&1 || true
```

### Claude Code settings snippet

**`~/.claude/settings.json`** additions:

```json
{
  "hooks": {
    "Stop": [
      {
        "matcher": "",
        "hooks": [{ "type": "command", "command": "~/.claude/hooks/workbench-notify.sh" }]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Task",
        "hooks": [{ "type": "command", "command": "~/.claude/hooks/workbench-notify.sh" }]
      }
    ]
  }
}
```

The Settings UI will display these snippets as copyable code blocks — no auto-writing to the user's home directory.

---

## 8. Notification Hooks Config UI (per project)

In `Settings.vue` under a "Project" tab:

- Read `.workbench/workbench.json` via a new backend endpoint `GET /projects/:id/notification-hooks`
- Display `notifications.hooks` array: id, command, timeoutSeconds, enabled toggle
- Add / remove hooks
- Write back via `PUT /projects/:id/notification-hooks`

Backend reads/writes the file at the project's `repoPath + "/.workbench/workbench.json"`.

---

## Component & File Checklist

| File | Action |
|------|--------|
| `src/types/notification.ts` | Create |
| `src/api/notifications.ts` | Create |
| `src/composables/notifications.ts` | Create |
| `src/components/NotificationPanel.vue` | Create |
| `src/components/ui/NotificationBadge.vue` | Create (or reuse SidebarMenuBadge) |
| `src/components/WorkspaceSidebar.vue` | Modify — add badges |
| `src/components/Settings.vue` | Modify — add Notifications tab (hooks snippets + project hooks UI) |
| `src/App.vue` | Modify — provide notifications store, wire ⌘⇧I |

---

## Error Handling

- If `POST /notifications` fails from the hook script, it exits silently (`|| true`) — no user impact
- If the poll query fails, stale data is shown; vue-query retries automatically
- If `.workbench/workbench.json` does not exist, the hooks config UI shows an empty state with a "Create" action

---

## Out of Scope

- WebSocket / SSE push (can be added later as a polling replacement)
- Notification sound playback in the browser
- Per-worktree suppression rules in the frontend (cmux handles this natively)
