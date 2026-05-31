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

This downloads the Workbench binary (~10 MB) and places it on your `PATH`.

Installer script: [install.sh](https://blaise1030.github.io/workbench-cli/install.sh)

## First Launch

Start Workbench from anywhere:

```sh
workbench-cli
```

Workbench starts a local server and prints the URL — typically `https://workbench.local:4738`.

By default, Workbench uses HTTPS with a locally-trusted certificate via mkcert. To skip mkcert and use plain HTTP on localhost instead, pass `--http`:

```sh
workbench-cli --http
```

This serves on `http://localhost:4738`.

## One-time host setup

For HTTPS mode, add this line to your `/etc/hosts` once:

```
127.0.0.1 workbench.local
```

## Open in Browser

Open the printed URL in any modern browser. You will see the Workbench workspace with a terminal pane ready to use.

Workbench works with any AI agent that runs in a terminal: Claude Code, Codex, Aider, OpenCode, or anything else.
