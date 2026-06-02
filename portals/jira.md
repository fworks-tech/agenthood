# Connector: Jira

## What it provides
Access to Jira's issue tracking — read and update issues, sprints, epics,
and project boards. Used by The Architect to track and create work items
and by The Herald for standup briefings and release notes.

## Available Tools

| Tool | Description | Members |
|------|-------------|---------|
| `jira.issues.list` | List issues with JQL filter | Herald, Architect |
| `jira.issues.get` | Read a single issue's full description and comments | Architect, Scribe |
| `jira.issues.create` | Create a new issue in a project | Architect |
| `jira.issues.update` | Update status, assignee, priority, or labels | Architect, Herald |
| `jira.issues.transition` | Move an issue to a new workflow status | Herald, Architect |
| `jira.sprints.list` | List sprints for a board | Herald, Architect |
| `jira.sprints.get` | Get issues in a specific sprint | Herald |
| `jira.epics.list` | List epics in a project | Architect |
| `jira.projects.list` | List accessible projects | Architect |
| `jira.boards.list` | List boards | Architect, Herald |

## Primary Members
- **The Architect** — reads and creates issues when speccing work, links issues to branches
- **The Herald** — reads sprint progress for standup briefings and release notes

## Setup

Add to your agent runtime's MCP configuration:

```json
{
  "mcp": {
    "servers": {
      "jira": {
        "command": "npx",
        "args": ["-y", "@atlassian/jira-mcp"],
        "env": {
          "JIRA_BASE_URL": "${JIRA_BASE_URL}",
          "JIRA_USER_EMAIL": "${JIRA_USER_EMAIL}",
          "JIRA_API_TOKEN": "${JIRA_API_TOKEN}"
        }
      }
    }
  }
}
```

Generate an API token at **id.atlassian.com → Security → API tokens**.

| Env var | Example value |
|---------|--------------|
| `JIRA_BASE_URL` | `https://your-org.atlassian.net` |
| `JIRA_USER_EMAIL` | `you@example.com` |
| `JIRA_API_TOKEN` | Token from id.atlassian.com |

## Notes
- Rate limit: varies by plan; Cloud Basic allows ~100 requests / minute
- JQL (Jira Query Language) is used for filtering — the MCP server handles translation
- Issue keys follow the pattern `PROJECT-NNN` (e.g., `ENG-42`)
- Jira Cloud and Jira Server/Data Center use different API versions; confirm your instance type
- The credential proxy injects credentials — members never access them directly
