# Terminal File Path Links Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** File paths printed in terminal output become clickable links that open the File Explorer panel and select that file.

**Architecture:** A new `createFileLinkProvider` factory in `terminal-file-links.ts` implements xterm's `ILinkProvider`, scanning each buffer line for absolute paths under the worktree root. `Terminal.vue` registers this provider on mount and wires clicks to open the explorer panel via `useWorktreePanels` + `router.push`.

**Tech Stack:** `@xterm/xterm` v5 `ILinkProvider` API, Vue 3, `vue-router`, `useWorktreePanels` (localStorage panel state), Vitest

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `frontend/src/modules/terminal/lib/terminal-file-links.ts` | Create | Pure path extraction + xterm `ILinkProvider` factory |
| `frontend/src/modules/terminal/lib/terminal-file-links.test.ts` | Create | Unit tests for path extraction logic |
| `frontend/src/modules/terminal/pages/Terminal.vue` | Modify | Register link provider on mount |

---

## Task 1: Create `terminal-file-links.ts` with unit tests (TDD)

**Files:**
- Create: `frontend/src/modules/terminal/lib/terminal-file-links.test.ts`
- Create: `frontend/src/modules/terminal/lib/terminal-file-links.ts`

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/modules/terminal/lib/terminal-file-links.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { extractFilePaths } from "./terminal-file-links";

describe("extractFilePaths", () => {
  const root = "/home/user/project";

  it("returns empty array for line with no paths", () => {
    expect(extractFilePaths("no paths here", root)).toEqual([]);
  });

  it("returns empty for paths outside the worktree root", () => {
    expect(extractFilePaths("/usr/bin/node crashed", root)).toEqual([]);
  });

  it("returns empty when worktreePath is empty string", () => {
    expect(extractFilePaths("/home/user/project/src/app.ts", "")).toEqual([]);
  });

  it("matches an absolute path directly under the worktree root", () => {
    const results = extractFilePaths("/home/user/project/src/app.ts", root);
    expect(results).toHaveLength(1);
    expect(results[0].path).toBe("/home/user/project/src/app.ts");
    expect(results[0].text).toBe("/home/user/project/src/app.ts");
    expect(results[0].startX).toBe(0);
    expect(results[0].endX).toBe("/home/user/project/src/app.ts".length);
  });

  it("strips a trailing :line suffix, preserving raw text", () => {
    const results = extractFilePaths("/home/user/project/src/app.ts:42", root);
    expect(results).toHaveLength(1);
    expect(results[0].path).toBe("/home/user/project/src/app.ts");
    expect(results[0].text).toBe("/home/user/project/src/app.ts:42");
  });

  it("strips a trailing :line:col suffix", () => {
    const results = extractFilePaths("/home/user/project/src/app.ts:42:7", root);
    expect(results).toHaveLength(1);
    expect(results[0].path).toBe("/home/user/project/src/app.ts");
    expect(results[0].text).toBe("/home/user/project/src/app.ts:42:7");
  });

  it("finds a path embedded in surrounding text and reports correct startX", () => {
    const prefix = "Error: cannot open ";
    const line = `${prefix}/home/user/project/src/app.ts:10:5: not found`;
    const results = extractFilePaths(line, root);
    expect(results).toHaveLength(1);
    expect(results[0].path).toBe("/home/user/project/src/app.ts");
    expect(results[0].startX).toBe(prefix.length);
  });

  it("returns multiple paths found on the same line", () => {
    const line = "/home/user/project/a.ts and /home/user/project/b.ts";
    const results = extractFilePaths(line, root);
    expect(results).toHaveLength(2);
    expect(results[0].path).toBe("/home/user/project/a.ts");
    expect(results[1].path).toBe("/home/user/project/b.ts");
  });

  it("does not match the worktree root itself (must be a file inside it)", () => {
    expect(extractFilePaths("/home/user/project", root)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx vitest run frontend/src/modules/terminal/lib/terminal-file-links.test.ts
```

Expected: FAIL — `Cannot find module './terminal-file-links'`

- [ ] **Step 3: Implement `terminal-file-links.ts`**

Create `frontend/src/modules/terminal/lib/terminal-file-links.ts`:

```ts
import type { ILink, ILinkProvider, Terminal } from "@xterm/xterm";

const PATH_RE = /\/[^\s\x00-\x1f'"<>()\[\]{}]+/g;
const LINE_COL_RE = /:\d+(?::\d+)?$/;

export interface FileLinkMatch {
  /** Absolute path with :line:col stripped. */
  path: string;
  /** Raw matched text including any :line:col suffix. */
  text: string;
  /** 0-indexed column where the match starts in the line string. */
  startX: number;
  /** 0-indexed column immediately after the last char of the match. */
  endX: number;
}

/**
 * Scans a single line of terminal text for absolute paths under worktreePath.
 * Pure function — no xterm dependency, fully unit-testable.
 */
export function extractFilePaths(lineText: string, worktreePath: string): FileLinkMatch[] {
  if (!worktreePath) return [];
  const prefix = worktreePath.endsWith("/") ? worktreePath : `${worktreePath}/`;
  const results: FileLinkMatch[] = [];

  for (const match of lineText.matchAll(new RegExp(PATH_RE.source, "g"))) {
    const raw = match[0];
    const clean = raw.replace(LINE_COL_RE, "");
    if (!clean.startsWith(prefix)) continue;
    const startX = match.index!;
    results.push({ path: clean, text: raw, startX, endX: startX + raw.length });
  }
  return results;
}

/**
 * Creates an xterm ILinkProvider that highlights file paths in terminal output.
 *
 * @param terminal    The xterm Terminal instance (needed to read buffer lines).
 * @param getWorktreePath  Getter for the current worktree root path.
 * @param onActivate  Called with the clean absolute path when a link is clicked.
 */
export function createFileLinkProvider(
  terminal: Terminal,
  getWorktreePath: () => string,
  onActivate: (path: string) => void,
): ILinkProvider {
  return {
    provideLinks(y: number, callback: (links: ILink[] | undefined) => void): void {
      const line = terminal.buffer.active.getLine(y - 1);
      if (!line) {
        callback(undefined);
        return;
      }
      const text = line.translateToString(true);
      const matches = extractFilePaths(text, getWorktreePath());
      if (matches.length === 0) {
        callback(undefined);
        return;
      }
      callback(
        matches.map((m): ILink => ({
          // xterm range uses 1-indexed columns; end is inclusive last char
          range: {
            start: { x: m.startX + 1, y },
            end: { x: m.endX, y },
          },
          text: m.text,
          activate(_event: MouseEvent, _text: string): void {
            onActivate(m.path);
          },
        })),
      );
    },
  };
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npx vitest run frontend/src/modules/terminal/lib/terminal-file-links.test.ts
```

Expected: all tests PASS.

- [ ] **Step 5: Verify TypeScript compiles**

```bash
npx tsc --noEmit -p frontend/tsconfig.json 2>&1 | head -30
```

Expected: no errors related to the new file. If `ILink` or `ILinkProvider` aren't exported from `@xterm/xterm`, check with:

```bash
node -e "console.log(Object.keys(require('./node_modules/@xterm/xterm/lib/xterm.js')))" 2>/dev/null | head -5
```

If those types aren't exported at the top level, import from `@xterm/xterm` using the same style as the existing `Terminal` import in `Terminal.vue` line 6.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/modules/terminal/lib/terminal-file-links.ts \
        frontend/src/modules/terminal/lib/terminal-file-links.test.ts
git commit -m "feat: add terminal file path link provider"
```

---

## Task 2: Wire link provider into `Terminal.vue`

**Files:**
- Modify: `frontend/src/modules/terminal/pages/Terminal.vue`

- [ ] **Step 1: Add imports**

In `Terminal.vue`, after the existing import on line 27 (`import { worktreeQueryOptions } from "@/modules/workspace/queries";`), add:

```ts
import { useRouter } from "vue-router";
import { useWorktreePanels } from "@/modules/workspace/lib/worktree-panels-storage";
import { createFileLinkProvider } from "@/modules/terminal/lib/terminal-file-links";
```

- [ ] **Step 2: Add composable calls**

After line 34 (`const route = useRoute();`), add:

```ts
const router = useRouter();
const panelsState = useWorktreePanels(worktreeId);
```

Note: `worktreeId` is defined at line 45 as `computed(() => route.params.worktreeId as string)`. Both new composable calls must appear after `worktreeId` is declared. Move the two new lines to after line 46 (`const { data: worktree } = useQuery(worktreeQueryOptions(worktreeId));`) to be safe.

- [ ] **Step 3: Register the link provider after `terminal.open(el)`**

In `onMounted`, after line 109 (`terminal.open(el);`), add:

```ts
    terminal.registerLinkProvider(
      createFileLinkProvider(
        terminal,
        () => worktree.value?.path ?? "",
        (path) => {
          panelsState.value = { ...panelsState.value, explorer: true };
          void router.push({
            name: "explorer",
            params: { worktreeId: worktreeId.value },
            query: { ...route.query, file: encodeURIComponent(path) },
          });
        },
      ),
    );
```

The full `onMounted` block after the change should look like:

```ts
onMounted(async () => {
  const el = terminalElRef.value;
  if (!el) return;

  await document.fonts.ready;

  try {
    const s = getComputedStyle(document.documentElement);
    terminal = new Terminal({
      cursorBlink: true,
      theme: buildTheme(),
      fontFamily: s.getPropertyValue("--font-mono").trim() || "monospace",
      allowTransparency: false,
    });

    fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);

    try {
      terminal.loadAddon(new WebglAddon());
    } catch {
      // WebGL unavailable, canvas renderer used instead
    }

    terminal.open(el);
    terminal.registerLinkProvider(
      createFileLinkProvider(
        terminal,
        () => worktree.value?.path ?? "",
        (path) => {
          panelsState.value = { ...panelsState.value, explorer: true };
          void router.push({
            name: "explorer",
            params: { worktreeId: worktreeId.value },
            query: { ...route.query, file: encodeURIComponent(path) },
          });
        },
      ),
    );
    fitAddon.fit();

    terminal.onData((data) => sessions.get(props.sessionId)?.sendInput(data));
    terminal.onResize(({ cols, rows }) => sessions.get(props.sessionId)?.sendResize(cols, rows));
    terminal.onTitleChange((title) => sessions.get(props.sessionId)?.setWindowTitle(title));

    resizeObserver = new ResizeObserver(() => fitAddon?.fit());
    resizeObserver.observe(el);

    fitInterval = setInterval(() => fitAddon?.fit(), 2_000);

    sessions.attach(props.sessionId, terminal);
    initError.value = null;
  } catch (err) {
    initError.value =
      err instanceof Error ? err.message : "Failed to load terminal emulator";
  }
});
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit -p frontend/tsconfig.json 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 5: Run all tests**

```bash
npx vitest run
```

Expected: all tests PASS.

- [ ] **Step 6: Manual smoke test**

```bash
npm run dev
```

1. Open a workspace in the app
2. In a terminal tab, run: `echo /path/to/your/worktree/src/some-file.ts`
   (substitute an actual file path from the current worktree)
3. Hover over the path — it should underline like a hyperlink
4. Click it — the File Explorer panel should open and that file should be selected
5. Run: `echo /usr/bin/node` — hovering this path should NOT underline (outside worktree)

- [ ] **Step 7: Commit**

```bash
git add frontend/src/modules/terminal/pages/Terminal.vue
git commit -m "feat: register file path link provider in Terminal.vue"
```
