# Plan 004: HTTP-level integration tests for the workspace router

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 9f5483a..HEAD -- apps/server-go/internal/workspace/router.go apps/server-go/internal/auth/middleware.go`
> If either file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none
- **Category**: tests
- **Planned at**: commit `9f5483a`, 2026-06-13

## Why this matters

The workspace router wires auth middleware, CORS enforcement, and all file/worktree
endpoints together. Unit tests cover the individual pieces (path guard, session
validation, rate limiter) but no test drives the router as a whole. This means
a middleware ordering mistake, a wrong route pattern, or a broken error response
shape can only be caught at runtime. Three categories of behaviour are highest
priority to cover: (1) auth middleware rejecting unauthenticated requests on
every route group, (2) CORS/origin enforcement blocking cross-origin mutations,
(3) the workspace file endpoints enforcing path containment end-to-end through
the HTTP layer.

## Current state

**Relevant files:**
- `apps/server-go/internal/workspace/router.go` — the router under test; `RegisterRoutes` signature:
  ```go
  func RegisterRoutes(r chi.Router, db *sql.DB, session *auth.Session, bus *events.Bus, launches PendingLaunchSetter)
  ```
- `apps/server-go/internal/auth/middleware.go` — `RequireSession` and `RequireOrigin` middleware
- `apps/server-go/internal/auth/middleware_test.go` — existing httptest pattern to follow
- `apps/server-go/internal/workspace/projects_test.go` — `openTestDB` helper to reuse

**Existing test helper to reuse (from `projects_test.go`):**
```go
func openTestDB(t *testing.T) *sql.DB {
    t.Helper()
    database, err := db.Open(":memory:")
    if err != nil { t.Fatal(err) }
    t.Cleanup(func() { database.Close() })
    if err := db.Migrate(database); err != nil { t.Fatal(err) }
    return database
}
```

**Existing httptest pattern to match (from `auth/middleware_test.go`):**
```go
func okHandler() http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        w.WriteHeader(http.StatusOK)
    })
}

func TestRequireOrigin_AllowsMatchingHost(t *testing.T) {
    h := RequireOrigin("localhost:4739")(okHandler())
    req := httptest.NewRequest(http.MethodPost, "/", nil)
    req.Header.Set("Origin", "http://localhost:4739")
    rr := httptest.NewRecorder()
    h.ServeHTTP(rr, req)
    if rr.Code != http.StatusOK {
        t.Errorf("expected 200, got %d", rr.Code)
    }
}
```

**`PendingLaunchSetter` interface** — read `router.go` to find the exact interface definition. It is used to notify the app when a terminal/agent launch is pending. For tests, implement it as a no-op struct:
```go
type noopLaunches struct{}
func (noopLaunches) SetPendingLaunch(_ string, _ any) {} // match actual method signature
```
STOP if the interface has more than 2 methods — report the actual interface and ask for guidance.

**Go module name:** `github.com/blaisetiong/workbench-cli/server-go` (from `go.mod`).

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Build check | `cd apps/server-go && go build ./...` | exit 0 |
| Run new tests | `cd apps/server-go && go test ./internal/workspace/... -v -run TestRouter` | all pass |
| Run all Go tests | `cd apps/server-go && go test ./...` | exit 0 |

## Scope

**In scope (create this file):**
- `apps/server-go/internal/workspace/router_test.go` — new file, package `workspace`

**Out of scope (do NOT touch):**
- `apps/server-go/internal/workspace/router.go` — the router is not modified by this plan
- `apps/server-go/internal/auth/middleware_test.go` — auth unit tests already exist; don't duplicate them
- Any frontend file

## Git workflow

- Branch: `advisor/004-workspace-router-http-tests`
- Commit: `test(workspace): add HTTP integration tests for router auth and file endpoints`
- Do NOT push or open a PR unless explicitly instructed.

## Steps

### Step 1: Read `router.go` to find the `PendingLaunchSetter` interface

Open `apps/server-go/internal/workspace/router.go` and find the `PendingLaunchSetter` type definition. Note its exact method signature(s). You will need this in Step 2.

STOP if: the interface has more than 2 methods (the no-op implementation becomes non-trivial and needs design input).

**Verify**: you can state the exact method signature(s) of `PendingLaunchSetter` before proceeding.

### Step 2: Create `router_test.go` with a test server helper

Create `apps/server-go/internal/workspace/router_test.go` in package `workspace`.

Write a `newTestServer` helper that:
1. Opens an in-memory DB using the existing `openTestDB(t)` helper (same package — call it directly, don't redefine it).
2. Creates an `auth.Session` via `auth.CreateSession()`.
3. Creates an `events.Bus` via `events.NewBus()`.
4. Creates a chi router, applies `auth.RequireSession(session)` and `auth.RequireOrigin("localhost")` middleware to a sub-router (mirror how the real server mounts routes), then calls `RegisterRoutes`.
5. Wraps it in `httptest.NewServer` and registers `t.Cleanup(srv.Close)`.
6. Returns the test server, the session, and the DB.

**Target shape:**

```go
package workspace

import (
    "net/http"
    "net/http/httptest"
    "testing"

    "github.com/go-chi/chi/v5"
    "github.com/blaisetiong/workbench-cli/server-go/internal/auth"
    "github.com/blaisetiong/workbench-cli/server-go/internal/events"
)

type noopLaunches struct{}

// implement PendingLaunchSetter methods here — fill from Step 1

func newTestServer(t *testing.T) (*httptest.Server, *auth.Session, *sql.DB) {
    t.Helper()
    database := openTestDB(t)
    session := auth.CreateSession()
    session.Activate()
    bus := events.NewBus()

    r := chi.NewRouter()
    r.Use(auth.RequireSession(session))
    r.Use(auth.RequireOrigin("localhost"))
    RegisterRoutes(r, database, session, bus, noopLaunches{})

    srv := httptest.NewServer(r)
    t.Cleanup(srv.Close)
    return srv, session, database
}

// authCookie returns a Cookie header value for a valid session.
func authCookie(session *auth.Session) string {
    return "sid=" + session.SID()
}
```

**Verify**: `cd apps/server-go && go build ./internal/workspace/...` → exit 0.

### Step 3: Write auth rejection tests

Add tests that confirm unauthenticated requests are rejected with 401 across
representative endpoints. Use `httptest.NewRequest` + `httptest.NewRecorder`
pattern from `auth/middleware_test.go`, or use `http.Get` against the
`httptest.Server` URL.

**Tests to write:**

```go
func TestRouter_UnauthedGetProjects_Returns401(t *testing.T) {
    srv, _, _ := newTestServer(t)
    res, err := http.Get(srv.URL + "/projects")
    if err != nil { t.Fatal(err) }
    defer res.Body.Close()
    if res.StatusCode != http.StatusUnauthorized {
        t.Errorf("want 401, got %d", res.StatusCode)
    }
}

func TestRouter_UnauthedGetWorktrees_Returns401(t *testing.T) {
    srv, _, _ := newTestServer(t)
    res, err := http.Get(srv.URL + "/worktrees")
    if err != nil { t.Fatal(err) }
    defer res.Body.Close()
    if res.StatusCode != http.StatusUnauthorized {
        t.Errorf("want 401, got %d", res.StatusCode)
    }
}
```

**Verify**: `cd apps/server-go && go test ./internal/workspace/... -v -run TestRouter_Unauthed` → both tests PASS.

### Step 4: Write CORS enforcement test

Add a test that confirms a POST from a wrong origin is blocked with 403.

```go
func TestRouter_WrongOrigin_Returns403(t *testing.T) {
    srv, session, _ := newTestServer(t)
    req, _ := http.NewRequest(http.MethodPost, srv.URL+"/projects", nil)
    req.Header.Set("Cookie", authCookie(session))
    req.Header.Set("Origin", "https://evil.example.com")
    req.Header.Set("Content-Type", "application/json")
    res, err := http.DefaultClient.Do(req)
    if err != nil { t.Fatal(err) }
    defer res.Body.Close()
    if res.StatusCode != http.StatusForbidden {
        t.Errorf("want 403, got %d", res.StatusCode)
    }
}
```

**Verify**: `cd apps/server-go && go test ./internal/workspace/... -v -run TestRouter_WrongOrigin` → PASS.

### Step 5: Write authenticated happy-path test

Add a test that confirms a valid session + correct origin gets a 200 (not 401 or 403) from GET /projects.

```go
func TestRouter_AuthedGetProjects_Returns200(t *testing.T) {
    srv, session, _ := newTestServer(t)
    req, _ := http.NewRequest(http.MethodGet, srv.URL+"/projects", nil)
    req.Header.Set("Cookie", authCookie(session))
    res, err := http.DefaultClient.Do(req)
    if err != nil { t.Fatal(err) }
    defer res.Body.Close()
    if res.StatusCode != http.StatusOK {
        t.Errorf("want 200, got %d", res.StatusCode)
    }
}
```

**Verify**: `cd apps/server-go && go test ./internal/workspace/... -v -run TestRouter_Authed` → PASS.

### Step 6: Write path containment end-to-end test

Register a real temp-dir project, then make an authenticated HTTP request to
the file content endpoint with a path traversal attempt. Confirm the response
is 400, not 200 or 500.

```go
func TestRouter_FileContent_PathTraversal_Returns400(t *testing.T) {
    srv, session, database := newTestServer(t)

    // Register a project pointing at a real temp dir.
    dir := t.TempDir()
    project, err := RegisterProject(database, dir)
    if err != nil { t.Fatalf("RegisterProject: %v", err) }

    // Find the main worktree for this project.
    wts, err := listWorktreesByProjectID(database, project.ID)
    if err != nil || len(wts) == 0 { t.Fatal("no worktrees for project") }
    wt := wts[0]

    // Attempt path traversal via the file content endpoint.
    req, _ := http.NewRequest(http.MethodGet,
        srv.URL+"/worktrees/"+wt.ID+"/files/content?path=../../etc/passwd", nil)
    req.Header.Set("Cookie", authCookie(session))
    res, err := http.DefaultClient.Do(req)
    if err != nil { t.Fatal(err) }
    defer res.Body.Close()
    if res.StatusCode != http.StatusBadRequest {
        t.Errorf("want 400 for path traversal, got %d", res.StatusCode)
    }
}
```

STOP if: `RegisterProject` requires a real git repo and the temp dir causes it
to error in a way that prevents the test from proceeding — adapt by pointing
at the repo root (`t.TempDir()` → a known git dir), or report back.

**Verify**: `cd apps/server-go && go test ./internal/workspace/... -v -run TestRouter_FileContent_PathTraversal` → PASS.

### Step 7: Run all tests

**Verify**: `cd apps/server-go && go test ./...` → exit 0, no regressions.

## Test plan

**New file**: `apps/server-go/internal/workspace/router_test.go`

Tests written in this plan:
- `TestRouter_UnauthedGetProjects_Returns401`
- `TestRouter_UnauthedGetWorktrees_Returns401`
- `TestRouter_WrongOrigin_Returns403`
- `TestRouter_AuthedGetProjects_Returns200`
- `TestRouter_FileContent_PathTraversal_Returns400`

Structural pattern: `auth/middleware_test.go` for httptest style; `projects_test.go` for DB setup.

**Verification**: `cd apps/server-go && go test ./internal/workspace/... -v -run TestRouter` → 5 tests, all PASS.

## Done criteria

- [ ] `apps/server-go/internal/workspace/router_test.go` exists
- [ ] `cd apps/server-go && go test ./internal/workspace/... -v -run TestRouter` → 5 tests pass
- [ ] `cd apps/server-go && go test ./...` → exit 0
- [ ] `cd apps/server-go && go build ./...` → exit 0
- [ ] Only `router_test.go` is created; no existing files are modified (`git diff --name-only`)
- [ ] `plans/README.md` status row updated to DONE

## STOP conditions

- `PendingLaunchSetter` has more than 2 methods — report the actual interface.
- `RegisterRoutes` signature has changed from the one in "Current state" — report the new signature.
- `RegisterProject` requires git in a way that blocks the path-traversal test — report and skip that test rather than hacking around it.
- Any step's verification fails twice after a reasonable fix attempt.

## Maintenance notes

- `newTestServer` is the fixture to extend for future router tests. Add it to a
  `testhelpers_test.go` file if it grows beyond 30 lines.
- The test mounts routes with `RequireSession` + `RequireOrigin` — if the real
  server ever changes middleware ordering, update the test fixture to match.
- The path-traversal test confirms the HTTP layer rejects the attempt; the unit
  test for `AssertPathWithinRoot` in `files_test.go` covers the function itself.
  Both are needed — one tests the guard, the other tests that the guard is wired in.
- Future tests worth adding: POST /projects with missing body → 400; DELETE
  /worktrees/:id for the main worktree → 400; GET /worktrees/:nonexistent → 404.
