# Plan 002: Checkout mutation uses typed client and invalidates branch list

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 9f5483a..HEAD -- apps/frontend/src/modules/workspace/queries/projects.ts apps/frontend/src/modules/workspace/queries/keys.ts`
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

`useCheckoutBranchMutation` is the only mutation in `queries/projects.ts` that
uses a raw `fetch()` call instead of the typed `apiClient`. More importantly, its
`onSuccess` handler does not invalidate `workspaceKeys.branches(pid)` after a
checkout. This means the branch list displayed in the UI (which branch is
currently checked out) does not refresh after the user checks out a branch — it
stays stale until the next window-focus refetch. The fix adds the missing
invalidation and migrates the call to `apiClient` for consistency with every
other mutation in the file.

## Current state

**Relevant files:**
- `apps/frontend/src/modules/workspace/queries/projects.ts` — all workspace
  mutations; `useCheckoutBranchMutation` is the one to change
- `apps/frontend/src/modules/workspace/queries/keys.ts` — query key factories;
  `workspaceKeys.branches(pid)` is what must be invalidated
- `apps/frontend/src/lib/api-client.ts` — the Hono RPC client; used by every
  other mutation in the file

**Current shape of `useCheckoutBranchMutation` (confirm this matches before editing):**

```ts
// apps/frontend/src/modules/workspace/queries/projects.ts
export function useCheckoutBranchMutation(projectId: MaybeRefOrGetter<string>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (branch: string) => {
      const res = await fetch(`/api/projects/${toValue(projectId)}/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ branch }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as any).error ?? "Checkout failed");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: workspaceKeys.worktrees() });
      toast.success("Branch checked out");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Checkout failed");
    },
  });
}
```

**Pattern to match — `useCreateWorktreeMutation` immediately below it:**

```ts
export function useCreateWorktreeMutation(projectId: MaybeRefOrGetter<string>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: { ... }) => {
      const res = await apiClient.projects[":id"].worktrees.$post({
        param: { id: toValue(projectId) },
        json: body,
      });
      const data = await ensureOk<{ worktree: Worktree }>(res);
      return data.worktree;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: workspaceKeys.worktrees() });
      toast.success("Worktree created");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to create worktree");
    },
  });
}
```

**The `workspaceKeys` factory (from `keys.ts`) — confirm `branches` exists:**

```ts
// apps/frontend/src/modules/workspace/queries/keys.ts
// The exact shape may vary — find the `branches` key factory and use it.
// It is called as: workspaceKeys.branches(projectId: string)
```

**Imports already present at the top of `projects.ts`** (do NOT add duplicates):
- `apiClient` from `@/lib/api-client`
- `ensureOk` from `@/lib/api-error`
- `workspaceKeys` from `./keys`
- `toast` from `vue-sonner`

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Typecheck | `pnpm typecheck` | exit 0, no type errors |
| Build frontend | `pnpm build` | exit 0 |
| Unit tests | `pnpm test` | exit 0 |

All commands from repo root.

## Scope

**In scope:**
- `apps/frontend/src/modules/workspace/queries/projects.ts` — the only file to change

**Out of scope (do NOT touch):**
- `apps/frontend/src/lib/api-client.ts` — do not add or change routes in the RPC client
- `apps/server-go/internal/workspace/router.go` — the Go checkout endpoint is unchanged
- `apps/frontend/src/modules/workspace/queries/keys.ts` — read it, do not modify it
- Any Vue component file — this plan touches only the query layer

## Git workflow

- Branch: `advisor/002-checkout-mutation-branches-invalidation`
- Commit: `fix(workspace): invalidate branches after checkout and use apiClient`
- Do NOT push or open a PR unless explicitly instructed.

## Steps

### Step 1: Check whether `apiClient` exposes the checkout endpoint

Open `apps/frontend/src/lib/api-client.ts` (read only). Look for a route that
matches `projects/:id/checkout` or similar.

- **If the route exists** (e.g. `apiClient.projects[":id"].checkout.$post`):
  proceed to Step 2A.
- **If the route does NOT exist**: proceed to Step 2B (keep raw fetch, fix
  only the invalidation).

### Step 2A: Replace raw `fetch` with `apiClient` (only if route exists)

Replace the `mutationFn` body with an `apiClient` call following the pattern
of `useCreateWorktreeMutation`. Use `ensureOk` for error extraction. The
`mutationFn` return type should be `void` or the server's response type.

**Target shape (2A):**

```ts
export function useCheckoutBranchMutation(projectId: MaybeRefOrGetter<string>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (branch: string) => {
      const res = await apiClient.projects[":id"].checkout.$post({
        param: { id: toValue(projectId) },
        json: { branch },
      });
      await ensureOk<{ ok: true }>(res);
    },
    onSuccess: () => {
      const pid = toValue(projectId);
      queryClient.invalidateQueries({ queryKey: workspaceKeys.worktrees() });
      queryClient.invalidateQueries({ queryKey: workspaceKeys.branches(pid) });
      toast.success("Branch checked out");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Checkout failed");
    },
  });
}
```

**Verify**: `pnpm typecheck` → exit 0.

### Step 2B: Keep raw fetch, fix invalidation only (if route does not exist)

If the `apiClient` does not expose the checkout route, do not add it (that
belongs in a separate task). Instead, only fix the `onSuccess` handler to also
invalidate `branches`:

**Target shape (2B):**

```ts
export function useCheckoutBranchMutation(projectId: MaybeRefOrGetter<string>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (branch: string) => {
      const res = await fetch(`/api/projects/${toValue(projectId)}/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ branch }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as any).error ?? "Checkout failed");
      }
    },
    onSuccess: () => {
      const pid = toValue(projectId);
      queryClient.invalidateQueries({ queryKey: workspaceKeys.worktrees() });
      queryClient.invalidateQueries({ queryKey: workspaceKeys.branches(pid) });
      toast.success("Branch checked out");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Checkout failed");
    },
  });
}
```

**Verify**: `pnpm typecheck` → exit 0.

### Step 3: Run all tests and build

**Verify**:
1. `pnpm test` → exit 0
2. `pnpm build` → exit 0

## Test plan

There are no unit tests for Vue query mutations in this codebase (TanStack
Query mutations are integration-tested via the running app, not unit-tested).
No new test file is needed. The done criteria cover typecheck and build.

If a future test harness is added for query mutations, the regression to cover
is: after `useCheckoutBranchMutation` succeeds, `workspaceKeys.branches(pid)`
must appear in the invalidated queries list.

## Done criteria

- [ ] `pnpm typecheck` exits 0
- [ ] `pnpm test` exits 0
- [ ] `pnpm build` exits 0
- [ ] `grep -n "branches" apps/frontend/src/modules/workspace/queries/projects.ts` shows the `branches` invalidation inside `useCheckoutBranchMutation`'s `onSuccess`
- [ ] Only `apps/frontend/src/modules/workspace/queries/projects.ts` is modified (`git diff --name-only`)
- [ ] `plans/README.md` status row updated to DONE

## STOP conditions

Stop and report back if:

- The current code in `projects.ts` does not contain the raw `fetch(` inside
  `useCheckoutBranchMutation` — the function may have been refactored since this
  plan was written.
- `workspaceKeys.branches` does not exist in `keys.ts` — stop and report the
  actual key name.
- Adding `workspaceKeys.branches(pid)` invalidation causes a TypeScript error
  that can't be resolved without changing `keys.ts` or `api-client.ts`.

## Maintenance notes

- If the `apiClient` checkout route is added later (Step 2A becomes available),
  finish the migration from raw fetch at that point.
- The `onSuccess` now captures `toValue(projectId)` in a local `pid` to avoid
  reactivity evaluation timing issues — keep this pattern in any future mutations
  that reference `projectId` in `onSuccess`.
- Reviewers: confirm both `workspaceKeys.worktrees()` and `workspaceKeys.branches(pid)`
  are present in `onSuccess`. Missing either causes a stale UI.
