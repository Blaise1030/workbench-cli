# Issue tracker

Issues live in **Linear** — team **Buildscape**, project **Workbench CLI** (`BUI-*` identifiers).

Use the Linear MCP (`list_issues`, `get_issue`, `save_issue`, `save_comment`, `list_issue_labels`).

## Triage state mapping

Linear has no `needs-triage` / `ready-for-agent` labels. Map canonical triage **state** roles to workflow status:

| Canonical state   | Linear status |
| ----------------- | ------------- |
| `needs-triage`    | Backlog       |
| `needs-info`      | Backlog       |
| `ready-for-agent` | Todo          |
| `ready-for-human` | Todo          |
| `wontfix`         | Canceled      |

## Category mapping

| Canonical     | Linear label   |
| ------------- | -------------- |
| `bug`         | Bug            |
| `enhancement` | Feature or Improvement |
