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

The host declares MCP servers in `.agenthood/config.json`. A member receives a server's tools only when its `allowed-tools` names `mcp.<server>.<tool>`.

```json
{
  "mcpServers": {
    "atlas": {
      "command": "node",
      "args": ["tools/atlas-mcp.js"],
      "env": { "ATLAS_TOKEN": "${env:ATLAS_TOKEN}" }
    },
    "linear": {
      "transport": "http",
      "url": "https://mcp.linear.app/mcp",
      "headers": { "Authorization": "Bearer ${env:LINEAR_TOKEN}" },
      "readOnly": true
    }
  }
}
```

| Field | Required | Description |
|-------|----------|-------------|
| `command` | For stdio | Command to spawn |
| `args` | No | Arguments for the command |
| `env` | No | Environment variables for a stdio server |
| `transport` | No | `stdio` (default) or `http` |
| `url` | For http | HTTP or HTTPS endpoint |
| `headers` | No | HTTP headers sent to the server |
| `readOnly` | No | Marks tools as read-level for `restricted` members |

Values in `env` and `headers` are literals or `${env:VAR}` references. Secret-like keys must use a reference. Unknown keys, fields from the wrong transport and missing variables fail config load before any process starts or request is sent.

The full contract, scope rule, cache behavior and failure handling are in [MCP Servers for Members](../runtime-guide.md#mcp-servers-for-members-adr-047).

## Example: GitHub MCP Server

The GitHub MCP server gives your agent access to repos, PRs, issues and actions.

1. Get a GitHub Personal Access Token.
2. Add the server to `.agenthood/config.json`:

```json
{
  "mcpServers": {
    "github": {
      "transport": "http",
      "url": "https://api.githubcopilot.com/mcp",
      "headers": { "Authorization": "Bearer ${env:GITHUB_TOKEN}" },
      "readOnly": true
    }
  }
}
```

3. Set the token: `export GITHUB_TOKEN=ghp_xxx`.
4. Name the tools a member may use in its `allowed-tools` field.

The agent can then list and read PRs, check CI status, read files at any ref and search issues.

## Example: Custom MCP Server

An internal tool can be declared the same way:

```json
{
  "mcpServers": {
    "internal-api": {
      "transport": "http",
      "url": "https://internal.example.com/mcp",
      "headers": { "Authorization": "Bearer ${env:INTERNAL_TOKEN}" }
    }
  }
}
```

## Skills That Use MCP

A member declares MCP tools in its frontmatter:

```yaml
allowed-tools: mcp.github.list_pull_requests file.read
```

The skill loads the procedure, and the runtime grants only the named tools that the server actually lists and the member's profile permits.

## Disabling MCP Servers

Remove the server from `mcpServers`. There is no `enabled` flag, so a disabled server cannot be left half configured.

## Security Considerations

- Use `${env:VAR}` for tokens. Never hardcode secrets.
- Prefer HTTPS for remote servers.
- Mark a server `readOnly` when its tools do not write.
- The HTTP client does not follow redirects, so configured headers stay on the configured host.
- Tool arguments, results and header values are not written to decisions or provenance.
