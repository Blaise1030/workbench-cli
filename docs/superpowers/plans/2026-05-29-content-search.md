# Content Search Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `>` prefix mode to the command palette that searches text content across all files in the worktree, with debounced input, highlighted match snippets, line numbers, and a result count.

**Architecture:** A new `contentSearchFilesForWorktree` function in the TypeScript Hono server walks all files, reads each line, and returns `{ file, line, text }` matches. A new Hono route exposes it as `GET /worktrees/:id/files/content-search`. A `useContentSearch` composable in the frontend debounces queries (300ms) and feeds results into a new `>` mode branch in `CommandPalette.vue`.

**Tech Stack:** Node.js (line-by-line file reading), Hono RPC, Vue 3, @vueuse/core `useDebounceFn`, Tailwind CSS, Vitest

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Modify | `server/modules/workspace/files.ts` | Add `ContentMatch` type + `contentSearchFilesForWorktree` |
| Modify | `server/modules/workspace/files.test.ts` | Add tests for content search |
| Modify | `server/modules/workspace/router.ts` | Register `GET /worktrees/:id/files/content-search` |
| Create | `frontend/src/modules/command-palette/useContentSearch.ts` | Debounced composable for content search |
| Modify | `frontend/src/modules/command-palette/CommandPalette.vue` | `>` mode: detection, result rendering, highlight, count |

---

## Task 1: Add `contentSearchFilesForWorktree` to the server

**Files:**
- Modify: `server/modules/workspace/files.ts`

- [ ] **Step 1: Write the failing test first** (see Task 2 — do Task 2 before this step)

- [ ] **Step 2: Add `ContentMatch` type and function to `files.ts`**

Open `server/modules/workspace/files.ts`. At the bottom of the file, append:

```ts
export interface ContentMatch {
  file: string;
  line: number;
  text: string;
}

export async function contentSearchFilesForWorktree(
  worktreePath: string,
  query: string,
  limit: number,
): Promise<ContentMatch[]> {
  if (!query.trim()) return [];
  const q = query.toLowerCase();
  const allPaths = await listFilesForWorktree(worktreePath);
  const matches: ContentMatch[] = [];

  for (const relativePath of allPaths) {
    if (matches.length >= limit) break;
    let content: string;
    try {
      const result = await readFileForWorktree(worktreePath, relativePath);
      content = result.content;
    } catch {
      continue;
    }
    const lines = content.split("\n");
    for (let i = 0; i < lines.length; i++) {
      if (matches.length >= limit) break;
      if (lines[i].toLowerCase().includes(q)) {
        matches.push({ file: relativePath, line: i + 1, text: lines[i] });
      }
    }
  }

  return matches;
}
```

- [ ] **Step 3: Run the tests (after Task 2 is done)**

```bash
cd /Users/blaisetiong/Developer/v2/server && npx vitest run modules/workspace/files.test.ts
```

Expected: all tests pass including the new content search tests.

---

## Task 2: Add tests for `contentSearchFilesForWorktree`

**Files:**
- Modify: `server/modules/workspace/files.test.ts`

- [ ] **Step 1: Add import for new function**

Open `server/modules/workspace/files.test.ts`. Find the existing import:
```ts
import {
  listFilesForWorktree,
  readFileForWorktree,
  searchFilesForWorktree,
} from "./files.js";
```

Replace with:
```ts
import {
  listFilesForWorktree,
  readFileForWorktree,
  searchFilesForWorktree,
  contentSearchFilesForWorktree,
} from "./files.js";
```

- [ ] **Step 2: Add test suite at end of file**

```ts
describe("contentSearchFilesForWorktree", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "content-search-test-"));
    await mkdir(join(dir, "src"), { recursive: true });
    await writeFile(join(dir, "src/index.ts"), "export const hello = 'world';\nexport const foo = 42;\n");
    await writeFile(join(dir, "src/utils.ts"), "export function greet(name: string) {\n  return `hello ${name}`;\n}\n");
    await writeFile(join(dir, "README.md"), "# Project\n\nThis is a hello world example.\n");
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("returns matches with correct file, line, and text", async () => {
    const matches = await contentSearchFilesForWorktree(dir, "hello", 50);
    const files = matches.map((m) => m.file);
    expect(files).toContain("src/index.ts");
    expect(files).toContain("src/utils.ts");
    expect(files).toContain("README.md");
  });

  it("returns correct line numbers", async () => {
    const matches = await contentSearchFilesForWorktree(dir, "foo", 50);
    expect(matches).toHaveLength(1);
    expect(matches[0].file).toBe("src/index.ts");
    expect(matches[0].line).toBe(2);
    expect(matches[0].text).toBe("export const foo = 42;");
  });

  it("returns empty array for empty query", async () => {
    const matches = await contentSearchFilesForWorktree(dir, "", 50);
    expect(matches).toEqual([]);
  });

  it("returns empty array for whitespace-only query", async () => {
    const matches = await contentSearchFilesForWorktree(dir, "   ", 50);
    expect(matches).toEqual([]);
  });

  it("respects the limit", async () => {
    const matches = await contentSearchFilesForWorktree(dir, "hello", 2);
    expect(matches).toHaveLength(2);
  });

  it("is case-insensitive", async () => {
    const matches = await contentSearchFilesForWorktree(dir, "HELLO", 50);
    expect(matches.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail (function not yet implemented)**

```bash
cd /Users/blaisetiong/Developer/v2/server && npx vitest run modules/workspace/files.test.ts
```

Expected: `contentSearchFilesForWorktree` tests fail with "is not a function" or similar.

- [ ] **Step 4: Complete Task 1 Step 2, then run tests again**

```bash
cd /Users/blaisetiong/Developer/v2/server && npx vitest run modules/workspace/files.test.ts
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add server/modules/workspace/files.ts server/modules/workspace/files.test.ts
git commit -m "feat(server): add contentSearchFilesForWorktree with line-level matching"
```

---

## Task 3: Register the Hono route

**Files:**
- Modify: `server/modules/workspace/router.ts`

- [ ] **Step 1: Add import for new function**

Find the existing import in `server/modules/workspace/router.ts`:
```ts
import { FileReadError, listFilesForWorktree, readFileForWorktree, writeFileForWorktree, searchFilesForWorktree } from "./files.js";
```

Replace with:
```ts
import { FileReadError, listFilesForWorktree, readFileForWorktree, writeFileForWorktree, searchFilesForWorktree, contentSearchFilesForWorktree } from "./files.js";
```

- [ ] **Step 2: Add the route after the existing `files/search` route**

Find in `server/modules/workspace/router.ts`:
```ts
    .get("/worktrees/:id/files/search", async (c) => {
      const worktree = await getWorktree(db, c.req.param("id"));
      if (!worktree) return c.json({ error: "Worktree not found" }, 404);
      const q = c.req.query("q") ?? "";
      const limit = Math.min(parseInt(c.req.query("limit") ?? "50", 10), 100);
      if (!q.trim()) return c.json({ paths: [] });
      const paths = await searchFilesForWorktree(worktree.path, q, limit);
      return c.json({ paths });
    })
```

After that block (before `.get("/worktrees/:id/files/content"`), insert:
```ts
    .get("/worktrees/:id/files/content-search", async (c) => {
      const worktree = await getWorktree(db, c.req.param("id"));
      if (!worktree) return c.json({ error: "Worktree not found" }, 404);
      const q = c.req.query("q") ?? "";
      const limit = Math.min(parseInt(c.req.query("limit") ?? "50", 10), 100);
      if (!q.trim()) return c.json({ matches: [] });
      const matches = await contentSearchFilesForWorktree(worktree.path, q, limit);
      return c.json({ matches });
    })
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /Users/blaisetiong/Developer/v2/server && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add server/modules/workspace/router.ts
git commit -m "feat(server): add GET /worktrees/:id/files/content-search route"
```

---

## Task 4: Create `useContentSearch` composable

**Files:**
- Create: `frontend/src/modules/command-palette/useContentSearch.ts`

- [ ] **Step 1: Create the file**

```ts
import { computed, ref, watch, type Ref } from "vue";
import { useDebounceFn } from "@vueuse/core";
import { apiClient } from "@/lib/api-client";
import { ensureOk } from "@/lib/api-error";

export interface ContentMatch {
  file: string;
  line: number;
  text: string;
}

export function useContentSearch(
  worktreeId: Ref<string | undefined>,
  query: Ref<string>,
) {
  const results = ref<ContentMatch[]>([]);
  const isLoading = ref(false);

  const doSearch = useDebounceFn(async (id: string, q: string) => {
    if (!q.trim()) {
      results.value = [];
      return;
    }
    isLoading.value = true;
    try {
      const res = await apiClient.worktrees[":id"].files["content-search"].$get({
        param: { id },
        query: { q, limit: "50" },
      });
      const data = await ensureOk<{ matches: ContentMatch[] }>(res);
      results.value = data.matches;
    } catch {
      results.value = [];
    } finally {
      isLoading.value = false;
    }
  }, 300);

  watch(
    [worktreeId, query],
    ([id, q]) => {
      if (!id) {
        results.value = [];
        return;
      }
      void doSearch(id, q);
    },
  );

  const resultCount = computed(() => results.value.length);

  return { results, isLoading, resultCount };
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/blaisetiong/Developer/v2/frontend && npx tsc --noEmit
```

Expected: no errors. (If the Hono RPC type for `content-search` isn't inferred yet, the server must be running or types regenerated — skip TS check and verify at runtime in Task 5.)

- [ ] **Step 3: Commit**

```bash
git add frontend/src/modules/command-palette/useContentSearch.ts
git commit -m "feat(command-palette): add useContentSearch composable"
```

---

## Task 5: Wire content search mode into `CommandPalette.vue`

**Files:**
- Modify: `frontend/src/modules/command-palette/CommandPalette.vue`

- [ ] **Step 1: Add import for `useContentSearch` and `LoaderIcon`**

Find:
```ts
import { FileIcon, SearchIcon } from "@lucide/vue";
```

Replace with:
```ts
import { FileIcon, LoaderIcon, SearchIcon } from "@lucide/vue";
```

Find:
```ts
import { useFileSearch } from "./useFileSearch";
```

Replace with:
```ts
import { useFileSearch } from "./useFileSearch";
import { useContentSearch } from "./useContentSearch";
import type { ContentMatch } from "./useContentSearch";
```

- [ ] **Step 2: Add content mode computed refs (after the `isFileMode` and `fileQuery` lines)**

Find:
```ts
const isFileMode = computed(() => input.value.startsWith("@"));
const fileQuery = computed(() => (isFileMode.value ? input.value.slice(1) : ""));
```

Replace with:
```ts
const isFileMode = computed(() => input.value.startsWith("@"));
const fileQuery = computed(() => (isFileMode.value ? input.value.slice(1) : ""));
const isContentMode = computed(() => !isFileMode.value && input.value.startsWith(">"));
const contentQuery = computed(() => (isContentMode.value ? input.value.slice(1).trim() : ""));
```

- [ ] **Step 3: Wire in `useContentSearch` (after the `useFileSearch` line)**

Find:
```ts
const { results: fileResults, isLoading: fileLoading } = useFileSearch(worktreeIdRef, fileQuery);
```

Replace with:
```ts
const { results: fileResults, isLoading: fileLoading } = useFileSearch(worktreeIdRef, fileQuery);
const { results: contentResults, isLoading: contentLoading, resultCount: contentResultCount } = useContentSearch(worktreeIdRef, contentQuery);
```

- [ ] **Step 4: Add `highlightMatch` helper function (after `fileDirname`)**

Find:
```ts
function fileDirname(path: string) { const i = path.lastIndexOf("/"); return i >= 0 ? path.slice(0, i) : ""; }
```

After that line, add:
```ts
function highlightMatch(text: string, query: string) {
  const i = text.toLowerCase().indexOf(query.toLowerCase());
  if (i === -1) return { before: text.trimEnd(), match: "", after: "" };
  return { before: text.slice(0, i), match: text.slice(i, i + query.length), after: text.slice(i + query.length).trimEnd() };
}
```

- [ ] **Step 5: Update `filteredCommands` to suppress commands in content mode**

Find:
```ts
  const q = isFileMode.value ? "" : input.value.toLowerCase();
```

Replace with:
```ts
  const q = (isFileMode.value || isContentMode.value) ? "" : input.value.toLowerCase();
```

- [ ] **Step 6: Update `:disable-filter` on the Command component**

Find:
```html
<Command class="rounded-none! bg-transparent! p-0! h-auto!" :disable-filter="isFileMode">
```

Replace with:
```html
<Command class="rounded-none! bg-transparent! p-0! h-auto!" :disable-filter="isFileMode || isContentMode">
```

- [ ] **Step 7: Update the placeholder text to document `>` mode**

Find:
```html
placeholder="Type a command or @filename..."
```

Replace with:
```html
placeholder="Type a command, @filename, or >search content..."
```

- [ ] **Step 8: Add the result count bar and loading spinner (after the `<SearchIcon>` line in the input row)**

Find:
```html
              <SearchIcon class="size-4 shrink-0 text-muted-foreground" />
```

Replace with:
```html
              <SearchIcon v-if="!contentLoading" class="size-4 shrink-0 text-muted-foreground" />
              <LoaderIcon v-else class="size-4 shrink-0 text-muted-foreground animate-spin" />
```

After the closing `</div>` of the input row (the `border-b` div), add:
```html
            <div
              v-if="isContentMode && contentQuery && !contentLoading && contentResults.length > 0"
              class="px-3 py-1 text-xs text-muted-foreground border-b border-border/50"
            >
              {{ contentResultCount }} result{{ contentResultCount === 1 ? '' : 's' }}
            </div>
```

- [ ] **Step 9: Add the content search results section in the CommandList**

Find:
```html
                <!-- File mode -->
                <template v-if="isFileMode">
```

Before that line, add:
```html
                <!-- Content search mode -->
                <template v-if="isContentMode">
                  <div
                    v-if="!contentResults.length"
                    class="py-6 text-center text-xs text-muted-foreground"
                  >
                    <span v-if="!worktreeId">No active worktree</span>
                    <span v-else-if="!contentQuery">Type to search file contents</span>
                    <span v-else-if="contentLoading">Searching...</span>
                    <span v-else>No results found</span>
                  </div>
                  <CommandGroup v-if="contentResults.length" heading="In files" :class="GROUP_HEADING_CLASS">
                    <CommandItem
                      v-for="match in contentResults"
                      :key="`${match.file}:${match.line}`"
                      :value="`${match.file}:${match.line}`"
                      :class="ITEM_CLASS"
                      @select="() => openFile(match.file)"
                    >
                      <div class="flex flex-col gap-0.5 min-w-0 w-full">
                        <div class="flex items-center gap-2">
                          <span class="text-sm shrink-0 truncate">{{ fileName(match.file) }}</span>
                          <span class="text-xs text-muted-foreground shrink-0">:{{ match.line }}</span>
                          <span class="truncate text-xs text-muted-foreground">{{ fileDirname(match.file) }}</span>
                        </div>
                        <div class="text-xs font-mono text-muted-foreground truncate">
                          <span>{{ highlightMatch(match.text, contentQuery).before }}</span>
                          <mark class="bg-yellow-200/30 text-foreground rounded-sm not-italic">{{ highlightMatch(match.text, contentQuery).match }}</mark>
                          <span>{{ highlightMatch(match.text, contentQuery).after }}</span>
                        </div>
                      </div>
                    </CommandItem>
                  </CommandGroup>
                </template>

```

- [ ] **Step 10: Verify TypeScript compiles**

```bash
cd /Users/blaisetiong/Developer/v2/frontend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 11: Commit**

```bash
git add frontend/src/modules/command-palette/CommandPalette.vue
git commit -m "feat(command-palette): add > content search mode with highlight and result count"
```

---

## Task 6: Manual verification

- [ ] **Step 1: Start the dev server**

```bash
cd /Users/blaisetiong/Developer/v2 && npm run dev
```

- [ ] **Step 2: Open the app, trigger the command palette (Cmd+K)**

- [ ] **Step 3: Type `>hello` and verify**
  - Results appear with file name, line number, and matched line
  - The matched word is highlighted
  - A result count badge appears below the input
  - Clicking a result opens the file

- [ ] **Step 4: Verify `@` mode still works** (file name search unaffected)

- [ ] **Step 5: Verify command mode still works** (no prefix, commands still listed)
