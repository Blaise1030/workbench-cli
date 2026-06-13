# Scoped event bus — stop cross-worktree git refetch storms

## Problem
With multiple agents editing concurrently, every worktree's working-tree writes
fire `git-status:<id>` + `file-tree:<id>` SSE events every 400ms. The bus is a
**global, unfiltered broadcast** (`events/bus.go`), so every client receives every
worktree's events. With `staleTime: 0` (`modules/git/queries/git.ts`), each event
forces an immediate refetch of `git status` + every mounted `git diff`, spawning
git subprocesses → high server CPU + UI lag.

## Decision
Client only ever views **one** worktree (`route.params.worktreeId`). Scope the bus
so a connection receives per-worktree topics **only for the worktree it is viewing**.
Global topics (`sessions`, `worktrees`) still go to everyone. No passive sidebar git
signal needed.

## Design
A topic is *scoped* iff it contains `:` — the suffix is the worktree id
(`git-status:<id>`, `file-tree:<id>`). Topics without `:` are *global*.
A subscriber declares an interest set of worktree ids at connect time. The bus
delivers a topic iff it is global OR its id ∈ interest.

Interest is **fixed per connection**. When the active worktree changes, the client
reconnects the EventSource with a new query param (cheap, infrequent; EventSource
URLs are immutable).

## Server changes

### `internal/events/bus.go`
- Replace `subscribers map[chan string]struct{}` with a subscriber struct:
  ```go
  type subscriber struct {
      ch       chan string
      interest map[string]bool // worktree ids; nil/empty = global-only
  }
  ```
- `Subscribe(interest map[string]bool) *subscriber` (return the struct; keep the
  channel accessible for the handler to range over).
- `Unsubscribe(*subscriber)`.
- Change `Publish(message string)` → `Publish(topics ...string)`. The bus now owns
  filtering + marshaling: for each subscriber, compute the relevant subset
  (`relevant(topics, interest)`); if non-empty, `json.Marshal({"topics": subset})`
  and non-blocking send. Marshal happens per-subscriber but only on real events and
  over tiny arrays.
- Helper `scopeID(topic) (id string, scoped bool)` splits on first `:`.

### `internal/api/router.go` (`/api/events` handler)
- Parse `r.URL.Query().Get("worktree")` (comma-separated for generality) into the
  interest set; pass to `Subscribe`.
- Range over `sub.ch` as today.
- Drop the local `publishEvent` JSON marshaling — call `bus.Publish("sessions")` etc.

### Update all `Publish` callers to pass topics, not pre-marshaled JSON
- `internal/watcher/watcher.go:252-274` `publish()` — pass the built `topics` slice
  directly to `w.bus.Publish(topics...)`; delete local `json.Marshal`.
- `internal/api/router.go` `publishEvent` → `bus.Publish(topics...)`.
- `internal/workspace/router.go:27` `publishEvent` → `bus.Publish(topics...)`.
- `internal/notifications/router.go:19` → `bus.Publish(topics...)`.

## Client changes

### `lib/server-events.ts`
- `useServerEvents(activeWorktreeId: MaybeRefOrGetter<string | undefined>)`.
- Build URL: `/api/events` + (`?worktree=<id>` when an id is present).
- `watch(activeWorktreeId)`: on change, `es.close()` the old EventSource and open a
  new one with the new param. Keep `onUnmounted(() => es?.close())`.
- Message handling unchanged (still routes topics → invalidations).

### `App.vue`
- `const route = useRoute()` and pass
  `computed(() => route.params.worktreeId as string | undefined)` into
  `useServerEvents(...)`. Keep it mounted app-wide so global `sessions`/`worktrees`
  events still flow on non-workspace routes (interest empty → global-only).

## Edge cases
- Reconnect window on worktree switch: the new worktree's queries refetch on mount
  anyway (`staleTime: 0` + `refetchOnWindowFocus`), so no missed state.
- Empty interest (no active worktree): global-only delivery — correct.
- Non-blocking send semantics preserved (drop on full channel).

## Tests
- `bus_test.go`: subscriber with interest `{a}` receives `git-status:a` and global
  `sessions`, but NOT `git-status:b`; empty-interest subscriber receives only global.
- `relevant()` / `scopeID()` unit tests for the `:`-split rule.
- Verify all `Publish` call sites compile against the new variadic signature.

## Out of scope (optional follow-ups)
- Decoupling `git diff` refetch from every `git-status` tick (`server-events.ts`).
- Raising `debounceInterval` (`watcher.go:26`).
These further cut CPU on the *active* pane but are not required for the cross-worktree fix.
