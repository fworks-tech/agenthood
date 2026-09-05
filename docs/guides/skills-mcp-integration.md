# Skills + MCP Integration Pattern

Skills teach procedure. MCP provides access. This guide documents how to combine them.

## The Pattern

```
┌─────────────────────────────────────────────┐
│  Skill (SKILL.md)                          │
│  "How to review a PR"                      │
│  - Steps, rules, criteria                  │
│  - Calls activate_skill at runtime         │
└──────────────┬──────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────┐
│  MCP Server                                │
│  GitHub API access                         │
│  - List PRs, post comments, approve       │
│  - Read file diffs, check status          │
└─────────────────────────────────────────────┘
```

**Skills** define *what to do* and *how to do it*.
**MCP servers** provide *access to external systems*.

Together, they enable agents that follow procedures AND interact with the world.

## Configuration

MCP servers are configured in `.agenthood/config.json` or `opencode.json`:

```json
{
  "mcp": {
    "github": {
      "type": "remote",
      "url": "https://api.githubcopilot.com/mcp",
      "headers": {
        "Authorization": "Bearer {env:GITHUB_TOKEN}"
      }
    },
    "linear": {
      "type": "local",
      "command": ["npx", "-y", "@linear/mcp-server"],
      "environment": {
        "LINEAR_API_KEY": "{env:LINEAR_API_KEY}"
      }
    },
    "sentry": {
      "type": "remote",
      "url": "https://mcp.sentry.dev/mcp",
      "oauth": {}
    }
  }
}
```

### Configuration Fields

| Field | Required | Description |
|-------|----------|-------------|
| `type` | Yes | `remote` (HTTP/SSE) or `local` (stdio) |
| `url` | For remote | MCP server endpoint URL |
| `command` | For local | Array of command + args to spawn |
| `headers` | No | HTTP headers (supports `{env:VAR}` interpolation) |
| `environment` | No | Environment variables for local servers |
| `oauth` | No | OAuth configuration for remote servers |
| `enabled` | No | Set `false` to disable (default: true) |

## Example: GitHub MCP Server

The GitHub MCP server gives your agent access to repos, PRs, issues, and actions.

**Setup:**

1. Get a GitHub Personal Access Token
2. Add to config:

```json
{
  "mcp": {
    "github": {
      "type": "remote",
      "url": "https://api.githubcopilot.com/mcp",
      "headers": {
        "Authorization": "Bearer {env:GITHUB_TOKEN}"
      }
    }
  }
}
```

3. Set the token: `export GITHUB_TOKEN=ghp_xxx`

**What the agent can do:**
- List and read PRs
- Post comments and reviews
- Check CI status
- Read file contents at any ref
- Search code and issues

## Example: Linear MCP Server

The Linear MCP server enables issue tracking integration.

**Setup:**

```json
{
  "mcp": {
    "linear": {
      "type": "local",
      "command": ["npx", "-y", "@linear/mcp-server"],
      "environment": {
        "LINEAR_API_KEY": "{env:LINEAR_API_KEY}"
      }
    }
  }
}
```

**What the agent can do:**
- List and create issues
- Update issue status and assignees
- Search by project, priority, or label
- Read cycle and roadmap data

## Example: Custom MCP Server

For internal tools, build a custom MCP server:

```json
{
  "mcp": {
    "internal-api": {
      "type": "remote",
      "url": "https://internal.example.com/mcp",
      "headers": {
        "Authorization": "Bearer {env:INTERNAL_TOKEN}"
      }
    }
  }
}
```

## Skills That Use MCP

A skill can reference MCP tools in its Process section:

```markdown
## Process

### Review PR
1. Use the GitHub MCP tool to list open PRs
2. Read the diff for each PR
3. Check CI status
4. Post review comments using the GitHub MCP tool
5. Approve if all checks pass
```

The agent will call `activate_skill` to load the procedure, then use MCP tools to execute it.

## Disabling MCP Servers

To disable a server without removing it:

```json
{
  "mcp": {
    "old-server": {
      "enabled": false
    }
  }
}
```

## Security Considerations

- MCP servers run with the permissions you grant them
- Use `{env:VAR}` for tokens — never hardcode secrets
- Remote servers should use HTTPS
- Consider running untrusted servers in `--sandbox` mode
- The `enabled: false` flag lets you temporarily disable without deleting config
