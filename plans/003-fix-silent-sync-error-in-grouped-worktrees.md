# Plan 003: Log sync errors in ListAllWorktreesGrouped instead of discarding them

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 9f5483a..HEAD -- apps/server-go/internal/workspace/worktrees.go`
> If the file changed since this plan was written, compare the "Current state"
> excerpt against the live code before proceeding; on a mismatch, treat it as
> a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `9f5483a`, 2026-06-13

## Why this matters

`ListAllWorktreesGrouped` is the single endpoint that powers the workspace
sidebar — it fetches every project's worktrees in one request. For each project
it calls `syncWorktreesForProject`, which runs `git worktree list` to reconcile
the DB with the filesystem. If that git call fails (repo locked, git not on
PATH, disk issue), the current code silently discards the error (`_ = sync...`)
and proceeds to serve the last-known DB rows as if they were fresh.

The result: the UI shows stale worktrees with no indication anything went wrong,
making the failure nearly impossible to diagnose. The correct behaviour is to
log the error at warn level so it appears in server logs, while still returning
the stale-but-available data (failing the whole grouped response for a transient
sync error on one project would be worse).

## Current state

**Relevant file:**
- `apps/server-go/internal/workspace/worktrees.go` — contains `ListAllWorktreesGrouped` (around line 155–175; confirm exact line numbers before editing)

**Current `ListAllWorktreesGrouped` function (confirm this matches):**

```go
// ListAllWorktreesGrouped syncs every registered project's worktrees and
// returns them keyed by project id. Powers the sidebar's single fetch so the
// UI no longer needs one request per project.
func ListAllWorktreesGrouped(db *sql.DB) (map[string][]Worktree, error) {
	projects, err := ListProjects(db)
	if err != nil {
		return nil, err
	}
	grouped := make(map[string][]Worktree, len(projects))
	for _, p := range projects {
		_ = syncWorktreesForProject(db, p.ID)
		wts, err := listWorktreesByProjectID(db, p.ID)
		if err != nil {
			return nil, err
		}
		grouped[p.ID] = wts
	}
	return grouped, nil
}
```

**Repo logging convention:** The codebase uses `log/slog` (standard library,
Go 1.21+). Check the existing import in `worktrees.go`; if `log/slog` is not
already imported, add it. Other packages in the repo that use slog:
`apps/server-go/internal/terminal/ws.go` — use it as the style reference.
The call site pattern is:

```go
slog.Warn("description of what failed", "error", err, "contextKey", contextValue)
```

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Build Go | `cd apps/server-go && go build ./...` | exit 0 |
| Go tests (workspace) | `cd apps/server-go && go test ./internal/workspace/... -v` | all pass |
| Go tests (all) | `cd apps/server-go && go test ./...` | exit 0 |

Run from repo root unless the command itself `cd`s.

## Scope

**In scope:**
- `apps/server-go/internal/workspace/worktrees.go` — the only file to change

**Out of scope (do NOT touch):**
- `apps/server-go/internal/workspace/router.go` — the HTTP handler is unchanged
- Any other file — the import of `log/slog` is the only possible addition outside
  `ListAllWorktreesGrouped` itself, and only if the import block doesn't already
  include it

## Git workflow

- Branch: `advisor/003-log-sync-error-grouped-worktrees`
- Commit: `fix(workspace): log sync errors in ListAllWorktreesGrouped instead of discarding`
- Do NOT push or open a PR unless explicitly instructed.

## Steps

### Step 1: Check whether `log/slog` is already imported in `worktrees.go`

Open `apps/server-go/internal/workspace/worktrees.go` and look at the import
block at the top.

- If `"log/slog"` is already present: no import change needed, go to Step 2.
- If it is absent: add `"log/slog"` to the import block (keep imports
  alphabetically grouped by stdlib / external in the Go convention used by this
  file).

**Verify**: `cd apps/server-go && go build ./internal/workspace/...` → exit 0.

### Step 2: Replace the silent discard with a `slog.Warn` call

Find the line `_ = syncWorktreesForProject(db, p.ID)` inside
`ListAllWorktreesGrouped` and replace it with:

```go
if err := syncWorktreesForProject(db, p.ID); err != nil {
    slog.Warn("worktree sync failed for project; serving stale data", "projectID", p.ID, "error", err)
}
```

The surrounding code stays exactly as-is. Do not change the function signature,
the return type, or the behaviour on `listWorktreesByProjectID` errors.

**Target shape of the updated function:**

```go
func ListAllWorktreesGrouped(db *sql.DB) (map[string][]Worktree, error) {
	projects, err := ListProjects(db)
	if err != nil {
		return nil, err
	}
	grouped := make(map[string][]Worktree, len(projects))
	for _, p := range projects {
		if err := syncWorktreesForProject(db, p.ID); err != nil {
			slog.Warn("worktree sync failed for project; serving stale data", "projectID", p.ID, "error", err)
		}
		wts, err := listWorktreesByProjectID(db, p.ID)
		if err != nil {
			return nil, err
		}
		grouped[p.ID] = wts
	}
	return grouped, nil
}
```

**Verify**: `cd apps/server-go && go build ./internal/workspace/...` → exit 0.

### Step 3: Confirm the silent discard is gone

**Verify**: `grep -n "_ = syncWorktreesForProject" apps/server-go/internal/workspace/worktrees.go` → no output (zero matches).

### Step 4: Run the workspace test suite

**Verify**: `cd apps/server-go && go test ./internal/workspace/... -v` → all tests pass (no new failures).

### Step 5: Run all Go tests

**Verify**: `cd apps/server-go && go test ./...` → exit 0.

## Test plan

There is no existing test for `ListAllWorktreesGrouped`'s sync-error path. The
existing workspace tests (`projects_test.go`, `worktrees_delete_test.go`,
`files_test.go`) use `openTestDB` with an in-memory SQLite database and real
temp directories — match that pattern if adding a test.

A meaningful test would inject a project whose `RepoPath` is not a valid git
repo (so `syncWorktreesForProject` fails), call `ListAllWorktreesGrouped`, and
assert it returns successfully (no error) with the project's existing (empty)
worktree list. This is an optional addition; the plan's primary goal is
removing the silent discard, which is verifiable via grep. If you add the test,
place it in `apps/server-go/internal/workspace/worktrees_delete_test.go` or a
new `worktrees_test.go` (check whether the file exists first — if it does,
append; if not, create it in the same package `workspace`).

## Done criteria

- [ ] `cd apps/server-go && go build ./...` exits 0
- [ ] `cd apps/server-go && go test ./...` exits 0
- [ ] `grep -n "_ = syncWorktreesForProject" apps/server-go/internal/workspace/worktrees.go` returns no matches
- [ ] `grep -n "slog.Warn" apps/server-go/internal/workspace/worktrees.go` returns ≥ 1 match inside `ListAllWorktreesGrouped`
- [ ] Only `apps/server-go/internal/workspace/worktrees.go` is modified (`git diff --name-only`)
- [ ] `plans/README.md` status row updated to DONE

## STOP conditions

Stop and report back if:

- `worktrees.go` does not contain `_ = syncWorktreesForProject(db, p.ID)` — the
  function has been refactored since this plan was written.
- `syncWorktreesForProject` already returns something other than `error` — check
  the signature and report.
- The fix requires touching `router.go` or adding a new parameter to
  `ListAllWorktreesGrouped` — that is out of scope; stop and report.

## Maintenance notes

- The deliberate choice is to log-and-continue (not fail the request) because
  a transient git sync failure on one project should not black out the entire
  sidebar. If you ever want hard-fail behaviour (return an error), that is a
  product decision requiring a frontend change too.
- If structured logging is ever replaced (e.g. with a custom logger in
  `AppState`), update this call site to pass the logger through.
- Reviewers: confirm the log message includes both `"projectID"` and `"error"`
  fields — both are needed to diagnose failures in production logs.
