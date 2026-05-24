# File Explorer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the FileExplorerPanel using `@pierre/trees` (vanilla JS) to display a browsable, git-status-annotated file tree for the active worktree, with the selected file's full path persisted to the URL as an encoded query param.

**Architecture:** A new server endpoint `GET /worktrees/:id/files` recursively walks the worktree directory (skipping noise dirs) and returns relative paths. The Vue component mounts a `@pierre/trees` vanilla `FileTree` instance into a div ref, feeds it paths + git status, and syncs file selection to the URL via `?file=<encodeURIComponent(fullPath)>`.

**Tech Stack:** Hono (server route), `@pierre/trees` (vanilla JS file tree), Vue 3 + `vue-router` (component + URL sync), TanStack Query (data fetching), Vitest (tests)

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `server/modules/workspace/files.ts` | `listFilesForWorktree` — recursive fs walk, noise filtering |
| Create | `server/modules/workspace/files.test.ts` | Unit tests for the file listing function |
| Modify | `server/modules/workspace/router.ts` | Add `GET /worktrees/:id/files` route |
| Modify | `src/api/workspace.ts` | Add `workspaceKeys.fileTree` + `fileTreeQueryOptions` |
| Modify | `src/components/FileExplorerPanel.vue` | Full tree UI using `@pierre/trees` vanilla API |

---

## Task 1: Install `@pierre/trees`

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install the package**

```bash
npm install @pierre/trees
```

Expected: `@pierre/trees` appears in `package.json` dependencies.

- [ ] **Step 2: Verify TypeScript types are available**

```bash
node -e "const t = require('@pierre/trees'); console.log(typeof t)"
```

Expected: prints `object` (no error).

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: install @pierre/trees"
```

---

## Task 2: Server — `listFilesForWorktree` function

**Files:**
- Create: `server/modules/workspace/files.ts`
- Create: `server/modules/workspace/files.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `server/modules/workspace/files.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { listFilesForWorktree } from "./files.js";

describe("listFilesForWorktree", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "lan-term-files-"));
    // Create a small file tree
    mkdirSync(join(dir, "src", "components"), { recursive: true });
    mkdirSync(join(dir, "node_modules", "lodash"), { recursive: true });
    mkdirSync(join(dir, ".git"), { recursive: true });
    writeFileSync(join(dir, "src", "index.ts"), "");
    writeFileSync(join(dir, "src", "components", "Button.tsx"), "");
    writeFileSync(join(dir, "README.md"), "");
    writeFileSync(join(dir, "node_modules", "lodash", "index.js"), "");
    writeFileSync(join(dir, ".git", "config"), "");
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("returns relative posix paths for all files", async () => {
    const paths = await listFilesForWorktree(dir);
    expect(paths).toContain("README.md");
    expect(paths).toContain("src/index.ts");
    expect(paths).toContain("src/components/Button.tsx");
  });

  it("excludes node_modules", async () => {
    const paths = await listFilesForWorktree(dir);
    expect(paths.every((p) => !p.startsWith("node_modules"))).toBe(true);
  });

  it("excludes .git", async () => {
    const paths = await listFilesForWorktree(dir);
    expect(paths.every((p) => !p.startsWith(".git"))).toBe(true);
  });

  it("returns empty array for empty directory", async () => {
    const empty = mkdtempSync(join(tmpdir(), "lan-term-empty-"));
    try {
      const paths = await listFilesForWorktree(empty);
      expect(paths).toEqual([]);
    } finally {
      rmSync(empty, { recursive: true, force: true });
    }
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run server/modules/workspace/files.test.ts
```

Expected: FAIL — `Cannot find module './files.js'`

- [ ] **Step 3: Implement `listFilesForWorktree`**

Create `server/modules/workspace/files.ts`:

```typescript
import { readdir } from "node:fs/promises";
import { join, relative, sep } from "node:path";

const NOISE_DIRS = new Set([
  "node_modules",
  ".git",
  ".next",
  "dist",
  ".turbo",
  ".cache",
  "__pycache__",
  ".venv",
  ".DS_Store",
]);

export async function listFilesForWorktree(worktreePath: string): Promise<string[]> {
  const paths: string[] = [];

  async function walk(dir: string): Promise<void> {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (NOISE_DIRS.has(entry.name)) continue;
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
      } else {
        const rel = relative(worktreePath, fullPath);
        // Normalize to forward slashes for cross-platform consistency
        paths.push(rel.split(sep).join("/"));
      }
    }
  }

  await walk(worktreePath);
  return paths;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run server/modules/workspace/files.test.ts
```

Expected: All 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add server/modules/workspace/files.ts server/modules/workspace/files.test.ts
git commit -m "feat: add listFilesForWorktree with noise-dir filtering"
```

---

## Task 3: Server — `GET /worktrees/:id/files` route

**Files:**
- Modify: `server/modules/workspace/router.ts`

- [ ] **Step 1: Add the import at the top of `router.ts`**

Open `server/modules/workspace/router.ts`. After the existing imports, add:

```typescript
import { listFilesForWorktree } from "./files.js";
```

- [ ] **Step 2: Add the route**

In `router.ts`, inside `createWorkspaceRouter`, add this route after the existing `.get("/worktrees/:id", ...)` handler:

```typescript
    .get("/worktrees/:id/files", async (c) => {
      const worktree = await getWorktree(db, c.req.param("id"));
      if (!worktree) return c.json({ error: "Worktree not found" }, 404);
      const paths = await listFilesForWorktree(worktree.path);
      return c.json({ paths });
    })
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add server/modules/workspace/router.ts
git commit -m "feat: add GET /worktrees/:id/files endpoint"
```

---

## Task 4: API layer — `fileTreeQueryOptions`

**Files:**
- Modify: `src/api/workspace.ts`

- [ ] **Step 1: Add `fileTree` to `workspaceKeys`**

In `src/api/workspace.ts`, find the `workspaceKeys` object and add a new entry after `gitDiff`:

```typescript
  fileTree: (worktreeId: string) =>
    [...workspaceKeys.all, "file-tree", worktreeId] as const,
```

- [ ] **Step 2: Add `fileTreeQueryOptions`**

At the end of `src/api/workspace.ts`, add:

```typescript
export function fileTreeQueryOptions(worktreeId: MaybeRefOrGetter<string>) {
  return queryOptions({
    queryKey: computed(() => workspaceKeys.fileTree(toValue(worktreeId))),
    queryFn: async () => {
      const id = toValue(worktreeId);
      const res = await apiClient.worktrees[":id"].files.$get({
        param: { id },
      });
      const data = await ensureOk<{ paths: string[] }>(res);
      return data.paths;
    },
    enabled: computed(() => Boolean(toValue(worktreeId))),
    staleTime: Infinity,
  });
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: No errors. (The Hono RPC client infers the route type from the router — if there's a type error on `files.$get`, verify the route was added correctly in Task 3.)

- [ ] **Step 4: Commit**

```bash
git add src/api/workspace.ts
git commit -m "feat: add fileTreeQueryOptions for file tree API"
```

---

## Task 5: Vue component — `FileExplorerPanel`

**Files:**
- Modify: `src/components/FileExplorerPanel.vue`

The vanilla `@pierre/trees` API works like this:
- `new FileTree(options)` — creates the model
- `tree.render({ fileTreeContainer })` — mounts into a DOM element
- `tree.setGitStatus(record)` — updates git status annotations
- `tree.subscribe(listener)` — fires on any model change
- `tree.getSnapshot()` — returns current state (includes `selectedPaths: string[]`)
- `tree.cleanUp()` — full teardown (unmount + destroy)

Git status `Record<string, string>` maps relative path → one of: `"added"`, `"modified"`, `"deleted"`, `"renamed"`, `"untracked"`, `"ignored"`.

The `GitStatusEntry` from the project has `staged` and `unstaged` fields with codes like `"added"`, `"modified"`, `"deleted"`, `"renamed"`, `"untracked"`, `"ignored"`. Staged takes priority.

- [ ] **Step 1: Replace `FileExplorerPanel.vue` with the full implementation**

```vue
<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { FolderTreeIcon } from "@lucide/vue";
import { useQuery } from "@tanstack/vue-query";
import { FileTree } from "@pierre/trees";
import {
  fileTreeQueryOptions,
  gitStatusQueryOptions,
  worktreeQueryOptions,
  type GitStatusEntry,
} from "@/api/workspace";

const props = defineProps<{
  worktreeId: string;
}>();

const route = useRoute();
const router = useRouter();

const treeEl = ref<HTMLElement | null>(null);
let tree: InstanceType<typeof FileTree> | null = null;

const { data: worktree } = useQuery(worktreeQueryOptions(() => props.worktreeId));
const { data: paths } = useQuery(fileTreeQueryOptions(() => props.worktreeId));
const { data: gitStatus } = useQuery(gitStatusQueryOptions(() => props.worktreeId));

function toGitStatusMap(
  entries: GitStatusEntry[],
): Record<string, string> {
  const map: Record<string, string> = {};
  for (const entry of entries) {
    const code = entry.staged ?? entry.unstaged;
    if (!code || code === "unknown" || code === "unmerged" || code === "copied") continue;
    map[entry.path] = code;
  }
  return map;
}

function getFullPath(relativePath: string): string {
  return `${worktree.value?.path ?? ""}/${relativePath}`;
}

onMounted(() => {
  if (!treeEl.value || !paths.value) return;

  tree = new FileTree({ paths: paths.value });
  tree.render({ fileTreeContainer: treeEl.value });

  if (gitStatus.value) {
    tree.setGitStatus(toGitStatusMap(gitStatus.value.files));
  }

  // Restore selection from URL
  const encoded = route.query.file;
  if (typeof encoded === "string" && encoded) {
    const fullPath = decodeURIComponent(encoded);
    const worktreePath = worktree.value?.path ?? "";
    if (fullPath.startsWith(worktreePath + "/")) {
      const relativePath = fullPath.slice(worktreePath.length + 1);
      tree.getItem(relativePath)?.select();
    }
  }

  // Sync selection → URL
  tree.subscribe(() => {
    if (!tree) return;
    const snapshot = tree.getSnapshot();
    const selected = snapshot.selectedPaths[0];
    if (selected) {
      const encoded = encodeURIComponent(getFullPath(selected));
      router.replace({ query: { ...route.query, file: encoded } });
    } else {
      const query = { ...route.query };
      delete query.file;
      router.replace({ query });
    }
  });
});

// Update git status as it polls
watch(
  () => gitStatus.value,
  (status) => {
    if (!tree || !status) return;
    tree.setGitStatus(toGitStatusMap(status.files));
  },
);

// Mount tree once paths load (handles case where paths arrive after onMounted)
watch(
  () => paths.value,
  (newPaths) => {
    if (!newPaths || !treeEl.value || tree) return;
    tree = new FileTree({ paths: newPaths });
    tree.render({ fileTreeContainer: treeEl.value });
  },
);

onUnmounted(() => {
  tree?.cleanUp();
  tree = null;
});
</script>

<template>
  <div class="flex h-full min-h-0 flex-col bg-background">
    <div v-if="!paths" class="flex flex-1 items-center justify-center gap-3 p-6 text-center">
      <FolderTreeIcon class="size-10 text-muted-foreground/50" />
      <p class="text-sm text-muted-foreground">Loading…</p>
    </div>
    <div v-else ref="treeEl" class="h-full min-h-0 overflow-auto" />
  </div>
</template>
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: No errors. If `FileTree` import path is wrong, check the `@pierre/trees` package exports with:
```bash
node -e "console.log(Object.keys(require('@pierre/trees')))"
```

- [ ] **Step 3: Run the dev server and open the workspace**

```bash
npm run dev
```

Open the app, navigate to a workspace, add a File Explorer panel. Verify:
- File tree renders with the correct directory structure
- Expanding/collapsing folders works
- Git-modified files show status badges
- Clicking a file updates the URL to `?file=<encoded-path>`
- Refreshing the page with `?file=...` restores the selection

- [ ] **Step 4: Commit**

```bash
git add src/components/FileExplorerPanel.vue
git commit -m "feat: implement FileExplorerPanel with @pierre/trees and URL selection sync"
```

---

## Task 6: Run all tests

- [ ] **Step 1: Run the full test suite**

```bash
npx vitest run
```

Expected: All tests pass, including the new `files.test.ts`.

- [ ] **Step 2: Final commit if needed**

If any tests were fixed:
```bash
git add -p
git commit -m "fix: address test failures after file explorer implementation"
```
