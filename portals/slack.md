# Connector: Slack

## What it provides
Post messages to Slack channels and threads. Used by The Herald for
release announcements and standup briefings, and The Doorman for health alerts.

## Available Tools

| Tool | Description | Members |
|------|-------------|---------|
| `slack.post` | Post a message to a channel | Herald, Doorman |
| `slack.thread` | Reply to a thread | Herald |
| `slack.channels.list` | List available channels | Herald |

## Primary Members
- **The Herald** — morning briefings, release announcements, evening reports
- **The Doorman** — health check alerts, idle work warnings

## Setup

```json
{
  "mcp": {
    "servers": {
      "slack": {
        "command": "npx",
        "args": ["-y", "@modelcontextprotocol/server-slack"],
        "env": {
          "SLACK_BOT_TOKEN": "${SLACK_BOT_TOKEN}",
          "SLACK_TEAM_ID": "${SLACK_TEAM_ID}"
        }
      }
    }
  }
}
```

## Suggested Channel Routing

| Message type | Channel |
|-------------|---------|
| Morning briefing | `#dev-standup` |
| Release announcement | `#releases` |
| Health check alert | `#dev-alerts` |
| Evening report | `#dev-standup` |

## Notes
- Requires a Slack Bot Token with `chat:write` and `channels:read` scopes
- Post rate limit: 1 message per second per channel
- Messages are one-way — the Society posts but does not read Slack messages
