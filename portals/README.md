# Portals

> *The Society does not operate in isolation. It maintains portals.*

The Agenthood connects to external systems through Portals — MCP (Model Context Protocol)
servers that give members a window into outside worlds.
Issue trackers, monitoring systems, communication platforms, data stores.
The Society steps through. The Society steps back. Nothing leaks.

---

## Available Connectors

| Connector | What members can do | Primary user |
|-----------|-------------------|-------------|
| [github.md](github.md) | Read/create issues, PRs, releases, labels | The Herald, The Doorman, The Scribe |
| [linear.md](linear.md) | Read/update tickets, create branches from issues | The Architect, The Herald |
| [jira.md](jira.md) | Read/update tickets, create branches from issues | The Architect, The Herald |
| [slack.md](slack.md) | Post briefings, alerts, and release announcements | The Herald, The Doorman |
| [sentry.md](sentry.md) | Read error events, link to commits and PRs | The Debugger, The Auditor |

---

## How Connectors Work

Each connector is an MCP server configuration. Members call connector tools
through the standard tool interface — they do not call external APIs directly.

The credential proxy handles authentication — members never see raw API keys.

---

## Adding a Connector

1. Create a new `portals/[service].md` file using the template below
2. Configure the MCP server in your agent runtime's settings
3. Add the connector to `AGENTS.md` so all members know it exists
4. Update the table above

**Template:**
```markdown
# Connector: [Service Name]

## What it provides
What data and actions members can access through this connector.

## Available tools
List of MCP tool names and what each does.

## Which members use it
Which Society members need access and why.

## Setup
How to configure the MCP server for this connector.

## Notes
Rate limits, authentication requirements, known limitations.
```
