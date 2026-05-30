---
title: Getting Started
description: Install Workbench and open your workspace in a browser.
order: 1
---

## Install

Run the installer in your terminal:

```sh
curl -fsSL https://blaise1030.github.io/workbench-cli/install.sh | sh
```

This downloads the Workbench binary (under 20MB) and places it on your `PATH`.

Installer script: [install.sh](https://blaise1030.github.io/workbench-cli/install.sh)

## First Launch

Navigate to your project directory and start Workbench:

```sh
cd your-project
workbench
```

Workbench starts a local server and prints the URL — typically `http://localhost:3000`.

## Open in Browser

Open the printed URL in any modern browser. You will see the Workbench workspace with a terminal pane ready to use.

No configuration required. Workbench works with any AI agent that runs in a terminal: Claude Code, Codex, Aider, OpenCode, or anything else.
