# Theme Switcher Design

**Date:** 2026-05-31  
**Scope:** Add a `[DARK]` / `[LIGHT]` text toggle button to the site header.

## Architecture

No new files. All changes confined to two existing files:

- `landing/src/components/SiteHeader.astro` — add button + inline script
- `landing/src/layouts/Layout.astro` — extend existing inline script to check `localStorage` first

## Component Design

**Button:** A plain text element styled to match the existing nav links. Renders as `[LIGHT]` when currently in dark mode, `[DARK]` when in light mode (label = where clicking will take you... actually label = current mode, so user knows what mode they're in).

Correction: label reflects current state — `[DARK]` shown when dark mode is active, `[LIGHT]` shown when light mode is active. Clicking switches to the other mode.

**Placement:** Appended after the existing nav links in the `<nav>` on the right side of the header.

## Data Flow

1. **Page load** (`Layout.astro` inline script, runs before paint):
   - Check `localStorage.getItem('theme')`
   - If `'dark'` → add `.dark` to `<html>`
   - If `'light'` → ensure `.dark` is absent
   - If unset → fall back to `prefers-color-scheme: dark` check (existing behavior)

2. **Toggle click** (`SiteHeader.astro` inline script):
   - Read current state from `document.documentElement.classList.contains('dark')`
   - Toggle `.dark` class on `<html>`
   - Write new preference to `localStorage` (`'dark'` or `'light'`)
   - Update button label to reflect new state

## Styling

Match the existing `MarkdownLink` text style. No additional CSS needed — button uses `font-semibold` and inherits foreground color. Cursor pointer, no underline by default.

## Error Handling

None required — `localStorage` is universally supported in target browsers. No async operations.

## Testing

Manual: load page, toggle dark/light, refresh to verify persistence. Check both layouts (Layout.astro and DocsLayout.astro).
