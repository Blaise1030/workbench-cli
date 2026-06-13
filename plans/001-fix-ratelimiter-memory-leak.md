# Plan 001: RateLimiter stops accumulating stale IP entries

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 9f5483a..HEAD -- apps/server-go/internal/auth/ratelimit.go apps/server-go/internal/auth/ratelimit_test.go`
> If either file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `9f5483a`, 2026-06-13

## Why this matters

`RateLimiter` is used to throttle login attempts. Its internal `entries` map
grows by one entry per unique client IP that ever hits the auth endpoint, and
those entries are never removed. An expired entry is only *replaced* when the
same IP makes a new request; IPs that don't return stay in memory forever. On a
long-running server reachable to many clients this becomes an unbounded memory
leak. A background cleanup goroutine that periodically evicts expired entries
bounds the map to IPs active within the current window.

## Current state

**Relevant files:**
- `apps/server-go/internal/auth/ratelimit.go` — the rate limiter; contains the leak
- `apps/server-go/internal/auth/ratelimit_test.go` — existing tests; add the regression test here

**Current `ratelimit.go` (full file — confirm this matches before editing):**

```go
// apps/server-go/internal/auth/ratelimit.go
package auth

import (
	"sync"
	"time"
)

type ipEntry struct {
	count     int
	windowEnd time.Time
}

type RateLimiter struct {
	mu      sync.Mutex
	entries map[string]*ipEntry
	max     int
	window  time.Duration
}

func NewRateLimiter(max int, window time.Duration) *RateLimiter {
	return &RateLimiter{
		entries: make(map[string]*ipEntry),
		max:     max,
		window:  window,
	}
}

// Allow returns true if the IP has not exceeded the rate limit within the current
// fixed window. The window resets when the current time passes windowEnd.
func (rl *RateLimiter) Allow(ip string) bool {
	rl.mu.Lock()
	defer rl.mu.Unlock()
	now := time.Now()
	e, ok := rl.entries[ip]
	if !ok || now.After(e.windowEnd) {
		rl.entries[ip] = &ipEntry{count: 1, windowEnd: now.Add(rl.window)}
		return true
	}
	if e.count >= rl.max {
		return false
	}
	e.count++
	return true
}
```

**Repo conventions:** Go tests in this package use `t.Helper()` and subtests
(`t.Run`). See `apps/server-go/internal/auth/ratelimit_test.go` for the existing
pattern — match its style exactly.

## Commands you will need

| Purpose   | Command | Expected on success |
|-----------|---------|---------------------|
| Go tests (auth package) | `cd apps/server-go && go test ./internal/auth/... -v` | all pass, including new test |
| Go tests (all) | `cd apps/server-go && go test ./...` | exit 0 |
| Typecheck (frontend, unrelated but CI gate) | `pnpm typecheck` | exit 0 |

Run all commands from the repo root (`/path/to/v2`) unless the command itself `cd`s.

## Scope

**In scope:**
- `apps/server-go/internal/auth/ratelimit.go`
- `apps/server-go/internal/auth/ratelimit_test.go`

**Out of scope (do NOT touch):**
- `apps/server-go/internal/auth/router.go` — this plan does not change how `NewRateLimiter` is called
- Any other file — the fix is entirely inside the `RateLimiter` type

## Git workflow

- Branch: `advisor/001-ratelimiter-cleanup`
- Commit message style matches repo: `fix(auth): evict expired rate-limit entries to prevent memory leak`
- Do NOT push or open a PR unless explicitly instructed.

## Steps

### Step 1: Add a background cleanup goroutine in `NewRateLimiter`

Open `apps/server-go/internal/auth/ratelimit.go`.

Add a `purgeExpired` method and start a goroutine from `NewRateLimiter` that
calls it on a timer. Use `time.NewTicker` with an interval of `window` (one
full window between sweeps is conservative and correct). The goroutine must not
prevent the `RateLimiter` from being garbage-collected if the caller drops it,
so use a `context.Context` passed into `NewRateLimiter`, or — simpler and
matching this codebase's style — use a `stop chan struct{}` and a `Stop()`
method.

**Target shape for the changed file:**

```go
package auth

import (
	"sync"
	"time"
)

type ipEntry struct {
	count     int
	windowEnd time.Time
}

type RateLimiter struct {
	mu      sync.Mutex
	entries map[string]*ipEntry
	max     int
	window  time.Duration
	stop    chan struct{}
}

func NewRateLimiter(max int, window time.Duration) *RateLimiter {
	rl := &RateLimiter{
		entries: make(map[string]*ipEntry),
		max:     max,
		window:  window,
		stop:    make(chan struct{}),
	}
	go rl.cleanupLoop()
	return rl
}

// Stop shuts down the background cleanup goroutine. Call when the limiter is
// no longer needed (e.g. server shutdown).
func (rl *RateLimiter) Stop() {
	close(rl.stop)
}

func (rl *RateLimiter) cleanupLoop() {
	ticker := time.NewTicker(rl.window)
	defer ticker.Stop()
	for {
		select {
		case <-ticker.C:
			rl.purgeExpired()
		case <-rl.stop:
			return
		}
	}
}

func (rl *RateLimiter) purgeExpired() {
	rl.mu.Lock()
	defer rl.mu.Unlock()
	now := time.Now()
	for ip, e := range rl.entries {
		if now.After(e.windowEnd) {
			delete(rl.entries, ip)
		}
	}
}

// Allow returns true if the IP has not exceeded the rate limit within the current
// fixed window. The window resets when the current time passes windowEnd.
func (rl *RateLimiter) Allow(ip string) bool {
	rl.mu.Lock()
	defer rl.mu.Unlock()
	now := time.Now()
	e, ok := rl.entries[ip]
	if !ok || now.After(e.windowEnd) {
		rl.entries[ip] = &ipEntry{count: 1, windowEnd: now.Add(rl.window)}
		return true
	}
	if e.count >= rl.max {
		return false
	}
	e.count++
	return true
}
```

**Verify**: `cd apps/server-go && go build ./internal/auth/...` → exit 0, no errors.

### Step 2: Add a regression test in `ratelimit_test.go`

Open `apps/server-go/internal/auth/ratelimit_test.go`. Add a new test that
confirms the map shrinks after `purgeExpired` is called. Call `purgeExpired`
directly (it is exported at package level for this test since the test is in
the same package `auth`).

**Test to add (append to the existing test file):**

```go
func TestRateLimiter_purgeExpired(t *testing.T) {
	// Use a tiny window so entries expire immediately.
	rl := &RateLimiter{
		entries: make(map[string]*ipEntry),
		max:     5,
		window:  time.Millisecond,
		stop:    make(chan struct{}),
	}
	rl.Allow("192.0.2.1")
	rl.Allow("192.0.2.2")
	if got := len(rl.entries); got != 2 {
		t.Fatalf("before purge: want 2 entries, got %d", got)
	}
	time.Sleep(5 * time.Millisecond) // let both windows expire
	rl.purgeExpired()
	if got := len(rl.entries); got != 0 {
		t.Fatalf("after purge: want 0 entries, got %d", got)
	}
}
```

Note: the test constructs `RateLimiter` directly (not via `NewRateLimiter`) so
it does not start the goroutine — that's intentional; we test `purgeExpired`
in isolation.

**Verify**: `cd apps/server-go && go test ./internal/auth/... -v -run TestRateLimiter_purgeExpired` → PASS.

### Step 3: Run the full auth test suite

**Verify**: `cd apps/server-go && go test ./internal/auth/... -v` → all tests pass, including all pre-existing ones and the new `TestRateLimiter_purgeExpired`.

### Step 4: Run all Go tests

**Verify**: `cd apps/server-go && go test ./...` → exit 0.

## Test plan

- **New test**: `TestRateLimiter_purgeExpired` in `apps/server-go/internal/auth/ratelimit_test.go`
  - Confirms that entries whose window has expired are deleted by `purgeExpired`
  - Does not test the goroutine lifecycle (Stop/cleanupLoop) — that is tested implicitly by the existing test suite not deadlocking
- Model after existing tests in `ratelimit_test.go`
- **Verification**: `cd apps/server-go && go test ./internal/auth/... -v` → all pass

## Done criteria

- [ ] `cd apps/server-go && go build ./internal/auth/...` exits 0
- [ ] `cd apps/server-go && go test ./internal/auth/... -v` exits 0; `TestRateLimiter_purgeExpired` appears and passes
- [ ] `cd apps/server-go && go test ./...` exits 0
- [ ] `grep -n "stop.*chan" apps/server-go/internal/auth/ratelimit.go` returns a match (confirms the stop channel was added)
- [ ] `grep -n "purgeExpired" apps/server-go/internal/auth/ratelimit.go` returns ≥ 2 matches (definition + call in cleanupLoop)
- [ ] Only `ratelimit.go` and `ratelimit_test.go` are modified (`git diff --name-only`)
- [ ] `plans/README.md` status row updated to DONE

## STOP conditions

Stop and report back if:

- The code in `ratelimit.go` doesn't match the "Current state" excerpt — the file may have been changed since this plan was written.
- `go test ./...` fails on a test that was already failing before your edits (pre-existing failure — not your fault, but don't ship over it).
- The fix requires touching `router.go` or `server.go` to wire up `Stop()` — that is out of scope; note it and stop.

## Maintenance notes

- `Stop()` is defined but not yet wired to server shutdown. This is intentional — the process exits when the server stops, so the goroutine is cleaned up by the OS. Wire it to a shutdown hook only if goroutine leak detection (e.g. goleak) is added to tests.
- If the rate limiter ever needs to support distributed deployments (Redis-backed), replace this entire type. The current design is explicitly single-process.
- A reviewer should confirm the ticker interval (`rl.window`) is reasonable for the configured window. If the window is 1 minute, the map is swept every minute — acceptable.
