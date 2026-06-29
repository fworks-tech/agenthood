# Connector: Linear

## What it provides
Access to Linear's issue tracking — read and update cycles, projects, issues,
and team metadata. Used by The Architect to track work in progress and by
The Herald for standup briefings and release notes.

## Available Tools

| Tool | Description | Members |
|------|-------------|---------|
| `linear.issues.list` | List issues with filters (assignee, state, label, cycle) | Herald, Architect |
| `linear.issues.get` | Read a single issue's full description and comments | Architect, Scribe |
| `linear.issues.create` | Create a new issue in a team | Architect |
| `linear.issues.update` | Update state, priority, assignee, or cycle | Architect, Herald |
| `linear.issues.close` | Move issue to a completed state | Herald |
| `linear.cycles.list` | List cycles (sprints) for a team | Herald, Architect |
| `linear.cycles.get` | Get issues assigned to a specific cycle | Herald |
| `linear.projects.list` | List active projects | Architect, Herald |
| `linear.teams.list` | List teams and their states | Architect |
| `linear.labels.list` | List available labels for a team | Architect |

## Primary Members
- **The Architect** — reads and creates issues when speccing work, links issues to branches
- **The Herald** — reads cycle progress for standup briefings and release notes

## Setup

Add to your agent runtime's MCP configuration:

```json
{
  "mcp": {
    "servers": {
      "linear": {
        "command": "npx",
        "args": ["-y", "@linear/mcp"],
        "env": {
          "LINEAR_API_KEY": "${LINEAR_API_KEY}"
        }
      }
    }
  }
}
```

Generate an API key at **Linear → Settings → API → Personal API keys**.
The key needs `read` scope for read-only members and `write` scope if The Architect
or Herald need to create or update issues.

## Notes
- Rate limit: 1,500 requests / hour per API key
- Linear uses cursor-based pagination; the MCP server handles this automatically
- Issue identifiers follow the pattern `TEAM-NNN` (e.g., `ENG-42`)
- The credential proxy injects the key — members never access it directly
