# Connector: GitHub

## What it provides
Full access to the GitHub API — issues, pull requests, releases, labels,
milestones, branch protection, and repository metadata.

## Available Tools

| Tool | Description | Members |
|------|-------------|---------|
| `github.issues.list` | List open issues with filters | Herald, Doorman |
| `github.issues.create` | Create a new issue | Architect |
| `github.issues.update` | Update labels, milestone, assignees | Doorman, Herald |
| `github.issues.close` | Close an issue | Herald |
| `github.pr.list` | List open PRs with status | Herald, Doorman |
| `github.pr.get` | Read a PR's diff and description | Reviewer, Scribe |
| `github.pr.comment` | Post a comment on a PR | Reviewer, Debugger |
| `github.pr.review` | Submit a review (approve/request changes) | Reviewer |
| `github.releases.create` | Create a GitHub Release with notes | Herald |
| `github.releases.list` | List recent releases | Herald |
| `github.labels.list` | List available labels | Doorman |
| `github.labels.apply` | Apply labels to an issue or PR | Doorman |
| `github.branches.list` | List branches with last activity | Doorman, Herald |

## Primary Members
- **The Herald** — reads merged PRs for standups, creates releases
- **The Doorman** — reads open PRs for health checks, applies labels
- **The Scribe** — reads PR diff to generate descriptions
- **The Reviewer** — posts review comments

## Setup

```json
{
  "mcp": {
    "servers": {
      "github": {
        "command": "npx",
        "args": ["-y", "@modelcontextprotocol/server-github"],
        "env": {
          "GITHUB_PERSONAL_ACCESS_TOKEN": "${GITHUB_TOKEN}"
        }
      }
    }
  }
}
```

## Notes
- Requires a GitHub Personal Access Token with `repo` and `read:org` scopes
- Rate limit: 5,000 requests/hour for authenticated requests
- The credential proxy injects the token — members never access it directly
