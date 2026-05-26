# Context Queue Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a worktree-scoped context queue (top-right popover) where users append `# path` + selection via `Ctrl+L` on Git/Files, open the queue via `Ctrl+L` on terminal, and send to the shell only via a **Send to terminal** button.

**Architecture:** New `context-queue` module owns storage, formatting, path resolution, and send logic. `TerminalWorkspace` mounts the popover and registers a route-aware `Ctrl+L` handler. One keybinding action (`contextQueue.invoke`) avoids duplicate-chord collisions in `KeybindingsMap`. Send reuses `terminalSessionsKey` + `useWorktreePanels` for target terminal resolution.

**Tech stack:** Vue 3, `@vueuse/core`, existing keybindings API, `vue-sonner`, Vitest.

**Spec:** `docs/superpowers/specs/2026-05-26-context-queue-design.md`

---

## File map

| File | Action |
|------|--------|
| `src/modules/context-queue/lib/format-queue-append.ts` | Create |
| `src/modules/context-queue/lib/format-queue-append.test.ts` | Create |
| `src/modules/context-queue/lib/resolve-code-context.ts` | Create |
| `src/modules/context-queue/lib/resolve-code-context.test.ts` | Create |
| `src/modules/context-queue/lib/context-queue-storage.ts` | Create |
| `src/modules/context-queue/hooks/use-context-queue.ts` | Create |
| `src/modules/context-queue/hooks/use-context-queue-keybinding.ts` | Create |
| `src/modules/context-queue/components/ContextQueuePopover.vue` | Create |
| `server/schemas/api.ts` | Modify — add `contextQueue.invoke` |
| `src/modules/keyboard/options.ts` | Modify — default `Ctrl+l` |
| `src/modules/keyboard/types.ts` | Modify — descriptor |
| `src/modules/terminal/layout/TerminalWorkspace.vue` | Modify — mount popover + hook |
| `docs/superpowers/specs/2026-05-26-context-queue-design.md` | Modify — status → Approved |

---

### Task 1: `formatQueueAppend` (TDD)

**Files:**
- Create: `src/modules/context-queue/lib/format-queue-append.ts`
- Create: `src/modules/context-queue/lib/format-queue-append.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// format-queue-append.test.ts
import { describe, expect, it } from "vitest";
import { formatQueueAppend } from "./format-queue-append";

describe("formatQueueAppend", () => {
  it("formats path only", () => {
    expect(formatQueueAppend({ relativePath: "src/a.ts" })).toBe("# src/a.ts\n\n");
  });

  it("formats path and selection", () => {
    expect(
      formatQueueAppend({ relativePath: "src/a.ts", selection: "const x = 1;" }),
    ).toBe("# src/a.ts\nconst x = 1;\n\n");
  });

  it("trims selection", () => {
    expect(
      formatQueueAppend({ relativePath: "a.ts", selection: "  hi  " }),
    ).toBe("# a.ts\nhi\n\n");
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

Run: `npm test -- src/modules/context-queue/lib/format-queue-append.test.ts`  
Expected: FAIL — cannot resolve module

- [ ] **Step 3: Implement**

```ts
// format-queue-append.ts
export function formatQueueAppend({
  relativePath,
  selection,
}: {
  relativePath: string;
  selection?: string;
}): string {
  const path = relativePath.trim();
  const body = selection?.trim();
  let block = `# ${path}\n`;
  if (body) block += `${body}\n`;
  return `${block}\n`;
}
```

- [ ] **Step 4: Run test — expect PASS**

Run: `npm test -- src/modules/context-queue/lib/format-queue-append.test.ts`

- [ ] **Step 5: Commit**

```bash
git add src/modules/context-queue/lib/format-queue-append.ts src/modules/context-queue/lib/format-queue-append.test.ts
git commit -m "feat(context-queue): add formatQueueAppend helper"
```

---

### Task 2: `resolveCodeContext` (TDD)

**Files:**
- Create: `src/modules/context-queue/lib/resolve-code-context.ts`
- Create: `src/modules/context-queue/lib/resolve-code-context.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
import { describe, expect, it } from "vitest";
import {
  filePathFromDiffHost,
  selectionTextInRoot,
} from "./resolve-code-context";

describe("selectionTextInRoot", () => {
  it("returns trimmed selection inside root", () => {
    const root = document.createElement("div");
    const p = document.createElement("p");
    p.textContent = "hello world";
    root.append(p);
    document.body.append(root);
    const range = document.createRange();
    range.selectNodeContents(p);
    const sel = window.getSelection()!;
    sel.removeAllRanges();
    sel.addRange(range);
    expect(selectionTextInRoot(root)).toBe("hello world");
    sel.removeAllRanges();
    root.remove();
  });
});

describe("filePathFromDiffHost", () => {
  it("maps host index to item id", () => {
    const root = document.createElement("div");
    const h1 = document.createElement("diffs-container");
    const h2 = document.createElement("diffs-container");
    root.append(h1, h2);
    expect(filePathFromDiffHost(root, ["a.ts", "b.ts"], h2)).toBe("b.ts");
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

Run: `npm test -- src/modules/context-queue/lib/resolve-code-context.test.ts`

- [ ] **Step 3: Implement `resolve-code-context.ts`**

Core exports:

```ts
const DIFFS_HOST = "diffs-container";

export function selectionTextInRoot(root: HTMLElement | null): string { /* spec */ }

export function filePathFromDiffHost(
  root: HTMLElement,
  itemIds: readonly string[],
  host: HTMLElement,
): string | undefined { /* indexOf host in querySelectorAll */ }

/** Walk from event/selection node through shadow roots to diffs-container. */
export function findDiffsHost(root: HTMLElement, node: Node | null): HTMLElement | null { /* ... */ }

export function resolveExplorerPath(
  worktreePath: string,
  fileQueryEncoded: string | undefined,
): string | null { /* strip worktree prefix → relative */ }

export function resolveGitContext(opts: {
  root: HTMLElement;
  itemIds: readonly string[];
}): { relativePath?: string; selection: string } { /* host + checkbox fallbacks */ }

export function resolveExplorerContext(opts: {
  root: HTMLElement;
  worktreePath: string;
  fileQueryEncoded?: string;
}): { relativePath?: string; selection: string } { /* ... */ }
```

**Git path priority:** selection host → item id; else exactly one `:checked` `.git-diff-select-checkbox[data-git-diff-file-path]`; else if `itemIds.length === 1` use that id.

**Explorer path:** `resolveExplorerPath` from route `file` query.

- [ ] **Step 4: Run tests — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add src/modules/context-queue/lib/resolve-code-context.ts src/modules/context-queue/lib/resolve-code-context.test.ts
git commit -m "feat(context-queue): add code context resolution helpers"
```

---

### Task 3: Storage + `useContextQueue` hook

**Files:**
- Create: `src/modules/context-queue/lib/context-queue-storage.ts`
- Create: `src/modules/context-queue/hooks/use-context-queue.ts`

- [ ] **Step 1: Storage**

```ts
// context-queue-storage.ts
import { useLocalStorage } from "@vueuse/core";
import { computed, type MaybeRefOrGetter, toValue } from "vue";

export interface ContextQueueState {
  text: string;
}

const PREFIX = "lan-terminal:context-queue:";

export function useContextQueueStorage(worktreeId: MaybeRefOrGetter<string>) {
  const key = computed(() => `${PREFIX}${toValue(worktreeId)}`);
  return useLocalStorage<ContextQueueState>(key, { text: "" });
}
```

- [ ] **Step 2: Hook**

```ts
// use-context-queue.ts — requires terminalSessionsKey + worktreeId
export function useContextQueue(worktreeId: MaybeRefOrGetter<string>) {
  const storage = useContextQueueStorage(worktreeId);
  const sessions = useTerminalSessions();
  const panelsState = useWorktreePanels(worktreeId);
  const { data: terminals } = useTerminalsQuery(worktreeId);
  const popoverOpen = ref(false);

  const text = computed({
    get: () => storage.value.text,
    set: (v) => { storage.value = { text: v }; },
  });

  function resolveTerminalId(): string | null { /* active → last → first */ }

  function appendBlock(block: string) {
    const current = text.value;
    text.value = current ? `${current.replace(/\n?$/, "\n\n")}${block}` : block;
  }

  function appendFromContext(ctx: { relativePath?: string; selection: string }) {
    if (ctx.relativePath) {
      appendBlock(formatQueueAppend({ relativePath: ctx.relativePath, selection: ctx.selection || undefined }));
      return;
    }
    if (ctx.selection.trim()) {
      appendBlock(`${ctx.selection.trim()}\n\n`);
      toast.warning("Path unknown — appended selection only");
      return;
    }
    toast.error("Nothing to append");
  }

  function clear() { text.value = ""; }

  function send(): boolean {
    const body = text.value.trim();
    if (!body) return false;
    const id = resolveTerminalId();
    if (!id) { toast.error("Open a terminal first"); return false; }
    const payload = body.endsWith("\n") ? body : `${body}\n`;
    sessions.get(id)?.sendInput(payload);
    text.value = "";
    toast.success("Sent to terminal");
    return true;
  }

  function openPopover() { popoverOpen.value = true; }

  return { text, popoverOpen, appendBlock, appendFromContext, clear, send, openPopover, canSend: computed(...) };
}
```

- [ ] **Step 3: Commit**

```bash
git add src/modules/context-queue/lib/context-queue-storage.ts src/modules/context-queue/hooks/use-context-queue.ts
git commit -m "feat(context-queue): add storage and useContextQueue hook"
```

---

### Task 4: Keybinding action + route dispatch

**Files:**
- Modify: `server/schemas/api.ts` — add `"contextQueue.invoke"` to `KEYBINDING_ACTIONS`
- Modify: `src/modules/keyboard/options.ts` — `"contextQueue.invoke": "Ctrl+l"`
- Modify: `src/modules/keyboard/types.ts` — descriptor entry
- Create: `src/modules/context-queue/hooks/use-context-queue-keybinding.ts`

**Note:** Use **one** action `contextQueue.invoke` (not two `append`/`open` keys) because `KeybindingsMap` cannot store duplicate `Ctrl+l` chords.

- [ ] **Step 1: Server + defaults**

Add to `KEYBINDING_ACTIONS`:

```ts
"contextQueue.invoke",
```

Add descriptor:

```ts
{
  action: "contextQueue.invoke",
  label: "Context queue",
  description: "Ctrl+L: append on Git/Files, open queue on terminal",
},
```

- [ ] **Step 2: `useContextQueueKeybinding`**

```ts
export function useContextQueueKeybinding(opts: {
  worktreeId: MaybeRefOrGetter<string>;
  routeName: MaybeRefOrGetter<string | undefined>;
  worktreePath: MaybeRefOrGetter<string | undefined>;
  fileQuery: MaybeRefOrGetter<string | undefined>;
  gitItemIds: MaybeRefOrGetter<readonly string[]>;
  queue: ReturnType<typeof useContextQueue>;
}) {
  const { data: bindings } = useKeybindingsQuery();

  useEventListener(window, "keydown", (event) => {
    const map = bindings.value ?? KEYBINDING_OPTIONS;
    if (matchWorkspaceKeyAction(event, map) !== "contextQueue.invoke") return;
    consumeWorkspaceKeyEvent(event);

    const name = toValue(opts.routeName);
    if (name === "terminal") {
      opts.queue.openPopover();
      return;
    }
    if (name === "git") {
      const root = document.querySelector<HTMLElement>(".git-diff-code-view");
      if (!root) return;
      const ctx = resolveGitContext({ root, itemIds: toValue(opts.gitItemIds) });
      opts.queue.appendFromContext(ctx);
      return;
    }
    if (name === "explorer") {
      const root = document.querySelector<HTMLElement>(".file-preview-code-view");
      const wt = toValue(opts.worktreePath);
      if (!root || !wt) return;
      const ctx = resolveExplorerContext({
        root,
        worktreePath: wt,
        fileQueryEncoded: toValue(opts.fileQuery),
      });
      opts.queue.appendFromContext(ctx);
    }
  }, { capture: true });
}
```

- [ ] **Step 3: Commit**

```bash
git add server/schemas/api.ts src/modules/keyboard/options.ts src/modules/keyboard/types.ts src/modules/context-queue/hooks/use-context-queue-keybinding.ts
git commit -m "feat(context-queue): add Ctrl+L keybinding with route dispatch"
```

---

### Task 5: `ContextQueuePopover` UI

**Files:**
- Create: `src/modules/context-queue/components/ContextQueuePopover.vue`

- [ ] **Step 1: Build component**

Use `Popover`, `PopoverTrigger`, `PopoverContent`, `Button`, `Textarea` from `@/components/ui/*`.

Requirements:
- `v-model:open` bound to `queue.popoverOpen`
- Textarea: `v-model="queue.text"`, `data-native-keyboard`, `font-mono`, `rows={12}`
- **Send to terminal** — `@click="queue.send()"`, `:disabled="!queue.canSend"`
- **Clear** — `@click="queue.clear()"`
- Footer hint text (no send shortcut)
- Trigger: icon button `ListPlusIcon` or `InboxIcon`, `aria-label="Context queue"`, badge dot when `text.trim()` non-empty

- [ ] **Step 2: Manual smoke** (dev server): open popover, type, clear.

- [ ] **Step 3: Commit**

```bash
git add src/modules/context-queue/components/ContextQueuePopover.vue
git commit -m "feat(context-queue): add queue popover UI"
```

---

### Task 6: Integrate into `TerminalWorkspace`

**Files:**
- Modify: `src/modules/terminal/layout/TerminalWorkspace.vue`

- [ ] **Step 1: Wire queue + popover in header**

In `<script setup>`:

```ts
import ContextQueuePopover from "@/modules/context-queue/components/ContextQueuePopover.vue";
import { useContextQueue } from "@/modules/context-queue/hooks/use-context-queue";
import { useContextQueueKeybinding } from "@/modules/context-queue/hooks/use-context-queue-keybinding";
import { useRoute } from "vue-router"; // already present

const contextQueue = useContextQueue(() => props.worktreeId);

// gitItemIds: pass empty array by default; optional provide from GitPanel later
useContextQueueKeybinding({
  worktreeId: () => props.worktreeId,
  routeName: () => route.name as string | undefined,
  worktreePath: () => worktree.value?.path, // add worktree query if missing
  fileQuery: () => (typeof route.query.file === "string" ? route.query.file : undefined),
  gitItemIds: () => [],
  queue: contextQueue,
});
```

Add `useQuery(worktreeQueryOptions(() => props.worktreeId))` if not already available in layout.

In template, inside header `flex shrink-0 border-s` div **before** explorer button:

```vue
<ContextQueuePopover :queue="contextQueue" />
```

- [ ] **Step 2: Provide `gitItemIds` via inject (optional improvement)**

Export `contextQueueGitItemsKey` from a small `context-queue-keys.ts`. In `GitPanel.vue`, `provide(contextQueueGitItemsKey, computed(() => diffItems.value.map(i => i.id)))`. In `TerminalWorkspace`, `inject` and pass to keybinding hook. **If skipped:** DOM-only git resolution still works for selection; checkbox fallback needs checked inputs in DOM (already rendered).

- [ ] **Step 3: Run `npm run build` — expect success**

- [ ] **Step 4: Commit**

```bash
git add src/modules/terminal/layout/TerminalWorkspace.vue
git commit -m "feat(context-queue): mount queue in workspace header"
```

---

### Task 7: Git panel provide (checkbox fallback)

**Files:**
- Modify: `src/modules/git/pages/GitPanel.vue`
- Create: `src/modules/context-queue/lib/context-queue-keys.ts`

- [ ] **Step 1: Injection key + provide**

```ts
// context-queue-keys.ts
export const contextQueueGitItemIdsKey: InjectionKey<ComputedRef<string[]>> =
  Symbol("context-queue-git-item-ids");
```

In `GitPanel.vue`:

```ts
provide(contextQueueGitItemIdsKey, computed(() => diffItems.value.map((i) => i.id)));
```

In `TerminalWorkspace.vue`:

```ts
const gitItemIds = inject(contextQueueGitItemIdsKey, computed(() => []));
// pass () => gitItemIds.value to keybinding hook
```

- [ ] **Step 2: Commit**

```bash
git add src/modules/context-queue/lib/context-queue-keys.ts src/modules/git/pages/GitPanel.vue src/modules/terminal/layout/TerminalWorkspace.vue
git commit -m "feat(context-queue): provide git diff item ids for path resolution"
```

---

### Task 8: Spec status + manual QA

**Files:**
- Modify: `docs/superpowers/specs/2026-05-26-context-queue-design.md` — `Status: Approved`

- [ ] **Manual checklist**

1. Git → select lines → `Ctrl+L` → queue shows `# path` + selection  
2. Files → same  
3. `Ctrl+L` with no selection → `# path` only  
4. Terminal → `Ctrl+L` → popover opens; screen not cleared  
5. **Send to terminal** button → text at shell prompt; queue clears  
6. Commit message textarea → `Ctrl+L` does not append (native keyboard)  
7. Queue textarea → `Ctrl+L` does not append  
8. Settings → Keybindings shows **Context queue** `Ctrl+L`

- [ ] **Run full test suite**

Run: `npm test`  
Expected: all pass

- [ ] **Final commit**

```bash
git add docs/superpowers/specs/2026-05-26-context-queue-design.md
git commit -m "docs: mark context queue spec approved"
```

---

## Spec coverage (self-review)

| Spec requirement | Task |
|------------------|------|
| Top-right popover | Task 5–6 |
| `# path` + selection append | Task 1–2, 3 |
| `Ctrl+L` git/explorer append | Task 4 |
| `Ctrl+L` terminal open only | Task 4 |
| Send button only | Task 5 |
| No send shortcut | Task 5 (no Ctrl+Enter) |
| `sendInput` last/active terminal | Task 3 |
| Per-worktree localStorage | Task 3 |
| Toasts / disabled send | Task 3, 5 |
| Keybindings settings | Task 4 |
| `data-native-keyboard` on textarea | Task 5 |

**Intentional deviation:** Single keybinding action `contextQueue.invoke` instead of two actions sharing `Ctrl+l` (Record key collision).

---

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-26-context-queue.md`.

**Two execution options:**

1. **Subagent-Driven (recommended)** — fresh subagent per task, review between tasks  
2. **Inline Execution** — implement task-by-task in this session with checkpoints  

Which approach do you want?
