# Terminal File Path Links — Design Spec

## Overview

File paths printed in terminal output (e.g. from compiler errors, `grep`, `git status`) become clickable links via xterm.js's `registerLinkProvider` API. Clicking a path opens the File Explorer panel and selects that file.

## Architecture

### 1. `src/modules/terminal/lib/file-link-provider.ts` (new)

A factory function:

```ts
createFileLinkProvider(
  getWorktreePath: () => string,
  onActivate: (path: string) => void
): ILinkProvider
```

**`provideLinks(y, callback)`:**
- Reads buffer line `y` text from `terminal.buffer.active`
- Scans for absolute paths with regex `/\/[^\s\x00-\x1f'"<>()\[\]{}]+/g`
- Filters matches to paths that start with `getWorktreePath() + "/"`
- Strips trailing `:N` or `:N:M` line/col suffix from the matched text before passing to `onActivate`
- Returns link objects: `{ range: { start: {x,y}, end: {x,y} }, text, activate(_, text) }`

**`ILinkProvider` interface** (from `@xterm/xterm`):
```ts
interface ILinkProvider {
  provideLinks(bufferLineNumber: number, callback: (links: ILink[] | undefined) => void): void;
}
```

### 2. `src/components/Terminal.vue` (modify)

After `terminal.open(el)` and addons, register the provider:

```ts
import { useRouter } from "vue-router";
import { useWorktreePanels } from "@/modules/workspace/lib/worktree-panels-storage";
import { createFileLinkProvider } from "@/modules/terminal/lib/file-link-provider";

const router = useRouter();
const panelsState = useWorktreePanels(worktreeId);

// inside onMounted, after terminal.open(el):
terminal.registerLinkProvider(createFileLinkProvider(
  () => worktree.value?.path ?? "",
  (path) => {
    panelsState.value = { ...panelsState.value, explorer: true };
    void router.push({
      name: "explorer",
      params: { worktreeId: worktreeId.value },
      query: { ...route.query, file: encodeURIComponent(path) },
    });
  }
));
```

`worktree` and `worktreeId` are already present in `Terminal.vue`. `route` is already imported via `useRoute()`.

## Data Flow

1. xterm calls `provideLinks(y, callback)` for each visible buffer line
2. Provider scans the line text for `/absolute/path` patterns under the worktree root
3. User hovers → xterm underlines the matched range
4. User clicks → `onActivate(cleanPath)` fires
5. `panelsState.explorer = true` opens the File Explorer panel
6. Router navigates to `explorer` route with `?file=<encodeURIComponent(path)>`
7. `FileExplorerPanel` reads `route.query.file`, decodes it, and selects the file in the tree

## Path Matching

- **Pattern:** `/\/[^\s\x00-\x1f'"<>()\[\]{}]+/g`
- **Filter:** only paths starting with `worktreePath + "/"`
- **Line/col stripping:** remove trailing `:\d+` or `:\d+:\d+` before activating
- **Scope:** absolute paths only — relative paths are ambiguous in terminal output

## No New Dependencies

Uses `@xterm/xterm`'s existing `ILinkProvider` / `ILink` interfaces. No new npm packages required.

## Error Handling

- If `worktree.value?.path` is not yet loaded when a link is clicked, `onActivate` receives an empty prefix and the path filter produces no links — safe, no action taken.
- Provider is registered once on mount; xterm calls it on demand per line render.
