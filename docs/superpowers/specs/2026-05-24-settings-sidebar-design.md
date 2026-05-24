# Settings Page Sidebar Design

**Date:** 2026-05-24  
**Status:** Approved  
**Scope:** `src/modules/settings/layout/SettingsView.vue` only

## Overview

Replace the current horizontal tab bar in the settings layout with a left sidebar using the existing shadcn-vue Sidebar component system. The router structure, child pages, and all other files remain unchanged.

## Layout

Full-screen two-panel split using `SidebarProvider`:

```
┌─────────────────┬──────────────────────────────┐
│  Sidebar        │  SidebarInset                │
│                 │                              │
│  [Header]       │  <page title>                │
│  Settings       │  ─────────────               │
│                 │  <RouterView />              │
│  [Content]      │                              │
│  • General  ←   │                              │
│  • Network      │                              │
│                 │                              │
│  [Footer]       │                              │
│  ← Back         │                              │
└─────────────────┴──────────────────────────────┘
```

## Components

All imported from `@/components/ui/sidebar`:

- `SidebarProvider` — wraps the entire layout, provides collapse context
- `Sidebar` — the left panel
- `SidebarHeader` — contains the "Settings" title
- `SidebarContent` — scrollable nav area
- `SidebarGroup` + `SidebarGroupContent` — groups the nav items
- `SidebarMenu` + `SidebarMenuItem` + `SidebarMenuButton` — one item per route
- `SidebarFooter` — contains the "← Back" button
- `SidebarInset` — right content area

## Navigation Items

| Label   | Route name         |
|---------|--------------------|
| General | `settings-general` |
| Network | `settings-network` |

Each `SidebarMenuButton` receives `:isActive="route.name === '<route-name>'"` and calls `router.push({ name: '<route-name>' })` on click.

## Content Area (SidebarInset)

- Small `<header>` showing the current section title (derived from `route.name`)
- `<RouterView />` below it

## Back Navigation

`← Back` button in `SidebarFooter` calls `router.back()`. Same behaviour as the current layout.

## Files Changed

| File | Change |
|------|--------|
| `src/modules/settings/layout/SettingsView.vue` | Full rewrite — swap tab bar layout for sidebar layout |

No router changes. No child page changes. No new files.
