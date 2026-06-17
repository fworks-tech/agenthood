# Real-World Integration

> *An agent that only talks to itself is a thought experiment. Portals connect it to the world.*

---

## What it is

<!-- TODO: Issue #123 — Level 3 article content -->

_This article is coming in v1.6.0. See [issue #123](https://github.com/fworks-tech/agenthood/issues/123)._

**Covers:** Connecting agents to Slack, GitHub, Notion, Linear, and Sentry via Agenthood's Portals layer — and how `GitHubSkill` and its siblings give agents real-world reach with typed, auditable interfaces.

---

## Why it matters in production

<!-- TODO: Issue #123 -->

---

## How Agenthood implements it

<!-- TODO: Issue #123 -->

**Maps to:** `portals/` — external connectors for GitHub, Linear, Jira, Slack, Sentry

---

## Hands-on example

<!-- TODO: Issue #123 -->

---

## Further reading

- [`portals/`](../../portals/) — the Portals layer source
- [GitHub REST API documentation](https://docs.github.com/en/rest) — the GitHub portal target
- [Slack API](https://api.slack.com/) — the Slack portal target

---

## LinkedIn version

**Hook:** The moment your agent can post to Slack, comment on GitHub, and update Linear is the moment it stops being a demo.

**Why it matters:**
- Untyped API calls break silently when APIs change; Agenthood's portal skills are typed contracts
- Portals are auditable — every external action is logged before it executes
- The Society ships work; the Portals layer is how it delivers it

**→** [Read the full article →](https://agenthood.flabs.tech/academy/level-3-advanced-skills/01-real-world-integration/)
