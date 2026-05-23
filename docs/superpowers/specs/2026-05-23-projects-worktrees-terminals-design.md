# Projects, Worktrees & Persistent Terminals — Design Spec

**Date:** 2026-05-23  
**Status:** Implemented (v1)  
**Stack:** Vue 3 + TanStack Query + Hono RPC · SQLite + Drizzle · node-pty · git worktrees

---

## Overview

Evolve lan-terminal from a single home-directory shell into a **coding workspace**: users register **git projects**, manage **real git worktrees**, and open **terminals scoped to a worktree**. Terminal tabs persist in SQLite; closing a tab deletes its row. On server or browser reload, all saved tabs reopen with new PTYs spawned in the correct worktree path.

**v1 does not include:** tmux, scrollback replay, coding agents, or auto-scanning for repos.

---

## Domain model

```
Project (registered repo root)
  └── Worktree (git worktree — listed + creatable via UI)
        └── Terminal tab (persisted row; WS + PTY per connect)
```

| Entity | Rules |
|--------|--------|
| **Project** | Manually registered absolute path to a git repo (must contain `.git`). |
| **Worktree** | Real git worktree; discovered via `git worktree list --porcelain`, creatable via `git worktree add`. |
| **Terminal** | Belongs to one worktree; `cwd` for PTY = worktree `path`. Close tab = `DELETE` row. |

**Restore semantics:** Reconnecting (or server restart) spawns a **new** shell in the saved worktree path. No process survival across restart; no tmux.

---

## Persistence (SQLite + Drizzle)

**Location:** `~/.lan-terminal/data.db` (alongside existing TLS/config under app data dir).

### Schema

```sql
projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  repo_path TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL
)

worktrees (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  path TEXT NOT NULL,
  branch TEXT,              -- checked-out branch in this worktree
  base_branch TEXT,         -- branch used as start-point when created (null if N/A)
  git_dir TEXT,
  is_linked INTEGER NOT NULL DEFAULT 1,  -- false if missing on disk after sync
  created_at INTEGER NOT NULL,
  UNIQUE(project_id, path)
)

terminals (
  id TEXT PRIMARY KEY,
  worktree_id TEXT NOT NULL REFERENCES worktrees(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
)
```

**Tab lifecycle:** Create tab → `INSERT`. Close tab → `DELETE`. Reload worktree view → `GET` all rows → one tab per row. No separate “last session” table.

**Future:** `agents` table with `worktree_id`; `terminal_scrollback` blob table.

---

## Git module (server)

| Operation | Command / behavior |
|-----------|-------------------|
| Validate project | `git -C <repo> rev-parse --git-dir` |
| List worktrees | `git -C <repo> worktree list --porcelain` → parse blocks |
| Sync | Reconcile DB with porcelain (insert/update; set `is_linked = 0` if path gone) |
| List branches | `git -C <repo> branch --format=%(refname:short)` (+ optional `for-each-ref` for default branch) |
| Create worktree (existing branch) | `git worktree add <path> <branch>` |
| Create worktree (new branch) | `git worktree add -b <newBranch> <path> <baseBranch>` — `baseBranch` is the branch the user chose to create from |
| Errors | Return stderr to client (branch exists, path occupied, etc.) |

Run all git commands **only on the server** (never from the browser).

### Create worktree — branch rules

- User must always choose **which branch to create the worktree from** (`baseBranch`) via a combobox of local branches (default: repo’s current/default branch).
- **Mode A — checkout existing branch:** user picks an existing branch as the worktree branch; `baseBranch` is omitted in git command (`git worktree add <path> <branch>`). UI still shows “Create from” only when it helps (optional: hide when branch already exists and user selected it from list).
- **Mode B — new branch:** user enters a **new branch name**; server runs `git worktree add -b <newBranch> <path> <baseBranch>` where `baseBranch` is required.

Server validates: `baseBranch` exists; new branch name does not already exist; path is free.

---

## API (Hono RPC)

Base: `/api` (existing auth middleware).

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/projects` | List projects |
| `POST` | `/projects` | `{ repoPath }` — register project |
| `DELETE` | `/projects/:id` | Remove project (+ cascade worktrees/terminals) |
| `GET` | `/projects/:id/branches` | List local branch names (for create-worktree dialog) |
| `GET` | `/projects/:id/worktrees` | List worktrees (sync from git first) |
| `POST` | `/projects/:id/worktrees` | See below — create worktree |
| `DELETE` | `/worktrees/:id` | Remove DB row (optional: `git worktree remove` behind confirm) |
| `GET` | `/worktrees/:id/terminals` | List tabs |
| `POST` | `/worktrees/:id/terminals` | `{ title? }` — create tab |
| `PATCH` | `/terminals/:id` | `{ title?, sortOrder? }` |
| `DELETE` | `/terminals/:id` | Close tab |

**POST `/projects/:id/worktrees` body:**

```ts
{
  path?: string;           // optional; server suggests <repo>-<branch> sibling dir if omitted
  branch: string;          // branch to checkout in the new worktree
  baseBranch?: string;     // required when branch does not exist yet (new branch)
  isNewBranch?: boolean;   // explicit, or inferred server-side
}
```

- **Existing branch:** `{ branch: "main", path?: "..." }` → `git worktree add <path> main`
- **New branch:** `{ branch: "feat-x", baseBranch: "main", path?: "..." }` → `git worktree add -b feat-x <path> main`

Persist `base_branch` on the `worktrees` row when provided.

**WebSocket:** `GET /ws?terminalId=<uuid>` (cookie auth unchanged).

1. Validate session (incl. localhost auto-auth).
2. Load `terminal` → `worktree` → verify `worktree.path` exists.
3. On first `\x1b[RESIZE:…]` message, `pty.spawn($SHELL, { cwd: worktree.path, … })`.
4. On WS close, kill PTY (v1).

---

## Frontend architecture

### Layout: resizable left pane

Use existing **shadcn-vue Resizable** (`ResizablePanelGroup`, `ResizablePanel`, `ResizableHandle`).

```
┌─────────────────────┬──────────────────────────────────────────┐
│  Sidebar (resizable) │  Main: TerminalWorkspace + toolbar      │
│  ~20% default        │  ~80%                                    │
│  min 15% / max 40%   │                                          │
├─────────────────────┼──────────────────────────────────────────┤
│ Projects tree        │  Tabs + single wterm instance            │
│  ▼ my-app            │                                          │
│    main (worktree)   │                                          │
│    feat-x            │                                          │
│  ▶ other-repo        │                                          │
│  [+ Add project]       │                                          │
└─────────────────────┴──────────────────────────────────────────┘
```

**Left pane (`WorkspaceSidebar.vue`):**

- **Projects** as collapsible sections (accordion or tree).
- Under each project: worktrees from API (refetch on expand / after create).
- **Selection:** active worktree highlighted; click → navigate to terminal route.
- **Actions:** “Add project” (dialog: pick/type path), “New worktree” per project (dialog — see below).
- **Stale worktrees:** muted style + badge if `is_linked === false`.

### Create worktree dialog (`NewWorktreeDialog.vue`)

Opened from sidebar “New worktree” on a project. Loads branches via `GET /projects/:id/branches`.

| Field | Control | Notes |
|-------|---------|--------|
| **Create from** | `Select` / combobox | **Required.** Local branches; default = repo `HEAD` branch. Label: “Create from branch”. |
| **Branch** | `Select` or text input | Branch this worktree will use. Toggle or tabs: “Existing branch” vs “New branch”. |
| **Path** | `Input` (optional) | Filesystem path for worktree; placeholder auto-suggested from branch name. |
| **Submit** | Button | Calls `POST /projects/:id/worktrees`. |

**Flows:**

1. **Existing branch** — user selects e.g. `main` in **Branch**; **Create from** hidden or mirrors selection (not sent). `POST { branch: "main" }`.
2. **New branch** — user types e.g. `feat-login` in **Branch**; must pick **Create from** e.g. `main`. `POST { branch: "feat-login", baseBranch: "main", isNewBranch: true }`.

Show git stderr inline on failure. On success: invalidate worktrees query, navigate to new worktree (optional).
**Right pane:** existing `TerminalWorkspace` for the active worktree only.

**Panel width:** persist `sidebarWidth` in `localStorage` (optional v1; default 20%).

**Mobile (<768px):** v1 can use a sheet/drawer for the tree; or hide resize and full-width terminal with menu toggle — defer if needed.

### Routing

| Route | View |
|-------|------|
| `/` | Redirect to last worktree or first project picker state |
| `/w/:worktreeId` | Shell layout (sidebar + terminals) — primary workspace |

Project context derived from worktree record (no `:projectId` required in URL if worktree id is globally unique).

**Deep link:** `/w/<worktreeId>` loads sidebar selection + terminal tabs for that worktree.

### Data fetching

TanStack Query keys: `['projects']`, `['branches', projectId]`, `['worktrees', projectId]`, `['terminals', worktreeId]`.

Mutations invalidate on create/delete. Terminal tab create/close calls API immediately (DB is source of truth).

### Terminal client changes

- `TerminalSession` connects to `/ws?terminalId=<id>` instead of anonymous `/ws`.
- `TerminalWorkspace` receives `worktreeId` prop; loads tabs from API on mount; no local-only tab IDs.

---

## Restore flow

1. User opens `/w/:worktreeId`.
2. `GET /worktrees/:id/terminals` → render all tabs.
3. Each tab opens WS with its `terminalId` → PTY `cwd = worktree.path`.
4. Server restart: in-memory PTYs gone; same HTTP flow recreates shells in correct paths.

---

## App shell structure (new files)

| File | Role |
|------|------|
| `server/db/schema.ts` | Drizzle tables |
| `server/db/index.ts` | SQLite connection, migrations |
| `server/modules/projects/` | CRUD + git sync |
| `server/modules/worktrees/` | list/create/sync |
| `server/modules/terminals/` | tab CRUD |
| `src/layouts/WorkspaceLayout.vue` | ResizablePanelGroup wrapper |
| `src/components/WorkspaceSidebar.vue` | Projects + worktrees tree |
| `src/components/NewWorktreeDialog.vue` | Create worktree (from-branch + branch + path) |
| `src/views/WorkspaceView.vue` | Sidebar + TerminalWorkspace |

---

## Error handling

| Case | UX |
|------|-----|
| Invalid repo path on register | Toast + inline error from API |
| `git worktree add` fails | Show git stderr in dialog |
| Worktree path deleted on disk | Sidebar: “missing”; terminal route shows banner + remove action |
| WS connect to missing terminal | 404; remove stale tab |
| PTY spawn failure | Terminal shows error message in pane |

---

## Security

- All git/filesystem operations server-side; validate paths stay within registered project or git-reported worktree paths.
- Existing cookie session + localhost bypass unchanged.
- No new auth model in v1 (single-user LAN server).

---

## Testing

- **Unit:** porcelain parser, Drizzle repositories, path validation.
- **Integration:** register project → sync worktrees → create terminal → WS spawn uses correct `cwd` (mock `node-pty` or temp git fixture).
- **Frontend:** sidebar selection navigates; close tab calls DELETE.

---

## Implementation phases

1. **DB + projects API** — Drizzle schema, register/list/delete projects.
2. **Worktrees API** — list/sync/create via git module.
3. **Terminals API + WS** — terminal CRUD; handler uses `terminalId` + worktree `cwd`.
4. **UI shell** — resizable sidebar + tree; wire TerminalWorkspace to API.
5. **Polish** — stale worktree UI, panel width persistence, redirect `/` → last worktree.

---

## Out of scope (v1)

- Coding agents
- Scrollback persistence
- tmux / detach-without-kill while server runs
- Auto-scan `~/Developer` for repos
- `git worktree remove` automation (manual confirm later)

---

## Open decisions (defaults chosen)

| Topic | Decision |
|-------|----------|
| Data directory | `~/.lan-terminal/data.db` |
| URL | `/w/:worktreeId` |
| Close tab | `DELETE` terminal row |
| WS close | Kill PTY (v1) |
