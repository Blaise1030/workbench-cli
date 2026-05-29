# Content Search Mode — Design Spec

Date: 2026-05-29

## Overview

Extend the existing command palette with a content-search mode that searches text across all files in the current worktree using ripgrep on the backend.

---

## Trigger & Mode Switching

- Typing `>` as the first character in the command palette input activates content-search mode.
- A label ("Search in files") appears next to the input to confirm the active mode.
- Clearing the `>` prefix or pressing `Escape` exits content-search mode and returns to default palette behavior (file name search + commands).

---

## Results UI

Each result row displays:
- **File path** (relative to workspace root, dimmed) + **line number**
- **Matched line text** with the query term highlighted (e.g., bold or colored)

Additional UI elements:
- A result count label below the input (e.g., "23 results") updates with each search.
- A spinner replaces the search icon in the input while a request is in flight.
- Results are flat (not grouped by file) — the file path on each row provides visual grouping context.
- Maximum 50 results returned per query to keep the list manageable.
- Pressing Enter or clicking a result opens the file at that exact line.

---

## Debounce

Input is debounced at 300ms before triggering a server request.

---

## Backend

New Go endpoint:
```
GET /worktrees/:id/files/content-search?q=<query>
```

- Runs `rg --json <query>` (ripgrep) in the worktree directory.
- Returns structured JSON: `{ file: string, line: number, text: string }[]`
- Capped at 50 results server-side.
- No pre-indexing — ripgrep scans on demand.

---

## Frontend

New composable `useContentSearch`:
- Accepts a reactive query string.
- Debounces at 300ms.
- Calls the new endpoint and exposes `results`, `isLoading`, and `resultCount`.

`CommandPalette.vue` changes:
- Detect `>` prefix in the input to switch mode.
- In content-search mode, use `useContentSearch` instead of `useFileSearch`.
- Render the result count label and highlighted match text per row.

---

## Out of Scope

- Replace-in-files
- Regex search mode
- File type / glob filters
- Result grouping by file
