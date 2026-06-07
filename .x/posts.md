# X Drafts

---

**Category:** Observation
**Date:** 2026-06-01

Everyone's racing to put a browser inside the IDE.

We're going the other way: put the coding agent inside the browser.

Click any element on your running app and it goes straight to the agent. Stay where the app actually lives.

---

**Category:** Observation
**Date:** 2026-06-02

Electron bundle size anxiety hit different.

Rebuilt my entire agent orchestrator as an 18MB Go binary.

Serves the UI straight to a browser tab on localhost.

Accidentally the cleanest architecture I've written.

---

**Category:** Observation
**Date:** 2026-06-04

Running a terminal inside a browser tab.

Not a webview. Not Electron. The Go binary handles the PTY, the browser renders it.

Full devtools available the whole time. Weird but it works.

---

**Category:** Learning
**Date:** 2026-06-04

Shipping a Go binary that serves a Vue.js frontend taught me something.

Distribution got trivially easy. One file, runs anywhere, opens in a browser.

No installer. No Electron. No 300MB bundle.

---

**Category:** Update
**Date:** 2026-06-05

Added a git panel to Workbench CLI.

Staged and unstaged diffs, right in the browser. No terminal switching to run git status.

The browser tab is slowly becoming my entire dev environment.

---

**Category:** Update
**Date:** 2026-06-05

Built worktree switching into Workbench CLI.

Now I run 3 branches at the same time. Each worktree gets its own tab.

No context switching. No stashing. Just flip tabs.

How are you managing parallel branches?

---

**Category:** Observation
**Date:** 2026-06-06

My favourite thing about Workbench CLI running in a browser tab:

Cmd+1 to the agent. Cmd+2 to the preview.

No custom shortcuts. No config. Just the browser doing what it already does.

---

**Category:** Observation
**Date:** 2026-06-03

herdr's agent tab is clean. click an agent from the sidebar.
tab opens. configured command runs.

building the exact same pattern into workbench.

when two tools independently land on the same ux, it's probably right.

---

**Category:** Observation
**Date:** 2026-06-03

everyone ships dark mode and light mode and calls it done.

workbench should know what time it is. should work with you from morning to night.

light, afternoon, evening, dark. same idea as apple's dynamic wallpaper.

---
