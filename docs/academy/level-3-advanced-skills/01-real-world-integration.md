# Real-World Integration

> *An agent that only talks to itself is a thought experiment. Portals connect it to the world.*

---

## What it is

Real-world integration is the layer that lets an agent act on systems outside its own process — post a Slack message, comment on a GitHub PR, update a Linear ticket, file a Sentry alert. Without it, your agent is a very smart function that returns strings. With it, your agent closes the loop from reasoning to delivery.

The integration layer that Agenthood calls Portals is not a pile of HTTP calls. It is a set of typed skills, one per external system, that expose a deliberate subset of the target API. A `GitHubSkill` does not wrap the entire GitHub REST API — it exposes the actions an agent should take: create a comment, open a PR, merge a branch. Each action has typed input, typed output, and a logged execution trace.

The boundary matters. An agent with raw API access will find the most destructive endpoint and call it. An agent with a Portal skill can only do what the skill exposes — and the skill exposes what you decided an agent should be able to do. Portals are a security boundary as much as an integration boundary.

---

## Why it matters in production

Untyped API calls break silently. When GitHub renames a field in their REST response, your agent's `comment.body` becomes `comment.body_b64` and the agent proceeds with garbage. The failure does not throw — it produces a wrong action based on a wrong assumption, and you find out when a user reports it.

Typed portal skills solve this at compile time. The `GitHubSkill` interface declares the shape it expects; if the upstream API drifts, the skill's adapter layer is the one place that needs updating, and the agent's logic is untouched. The integration boundary is also the maintenance boundary.

The second production concern is auditability. Every external action an agent takes — every Slack post, every PR comment, every ticket update — must be logged before it executes, not after. An agent that posts to a customer-facing channel and then logs the post is an agent that cannot be rolled back. The Portals layer logs intent, arguments, and target *before* the HTTP call fires, so the audit trail exists even if the call fails or times out.

---

## How Agenthood implements it

The Portals layer (`src/portals/` does not exist yet) is planned to ship typed skills for the integrations the Society uses internally. `GitHubSkill` is the canonical example:

```typescript
import { GitHubSkill } from 'agenthood';

const github = new GitHubSkill({ token: process.env.GITHUB_TOKEN });

// Typed actions — no raw API surface, no unauthenticated calls
await github.createComment({
  repo: 'fworks-tech/agenthood',
  pr: 181,
  body: 'Reviewed by the-reviewer. 0 blockers, 2 nits. See trace.',
});

await github.openPR({
  repo: 'fworks-tech/agenthood',
  head: 'feat/issue-42-oauth-login',
  base: 'main',
  title: 'feat(auth): add OAuth2 login to API',
  body: 'Closes #42',
});

await github.mergePR({ repo: 'fworks-tech/agenthood', pr: 181, method: 'squash' });
```

Each method is a typed contract — input schema, output schema, logged execution. The skill does not expose `deleteRepository` or `forcePush`. It exposes what an agent should be able to do, and the security boundary is enforced by what the skill does not expose. Sibling skills (`SlackSkill`, `LinearSkill`, `SentrySkill`, `NotionSkill`) follow the same pattern.

---

## Hands-on example

```bash
# The Society's runtime composes portal skills into agent workflows
npx agenthood run the-herald "ship: cut release v1.8.0 and announce it"
```

The Herald orchestrates across portals — one agent, multiple integrations, one audit trail:

```
[think] Release v1.8.0 requires: tag, release notes, Slack announcement, Linear update.
[act]  github.createRelease({ tag: 'v1.8.0', notes: changelog })
[portal:github] logged → POST /repos/.../releases  (before execution)
[see]  Release v1.8.0 published.
[act]  slack.postMessage({ channel: '#engineering', text: 'v1.8.0 shipped — see changelog' })
[portal:slack]  logged → POST /conversations.postMessage  (before execution)
[see]  Message posted to #engineering.
[act]  linear.updateCycle({ cycle: 'current', status: 'released', version: 'v1.8.0' })
[portal:linear] logged → POST /cycles/update  (before execution)
[see]  Cycle updated.
[done] Release v1.8.0 shipped across GitHub, Slack, and Linear. 3 portal actions, 3 log entries.
```

Each `portal:*` line is the audit entry, written before the action. If any call fails, the log shows exactly which one and why.

---

## Further reading

- [`src/portals/GitHubSkill.ts`](../../../src/portals/GitHubSkill.ts) — the GitHub portal skill (planned)
- [GitHub REST API documentation](https://docs.github.com/en/rest) — the target the GitHub portal wraps
- [Slack API](https://api.slack.com/) — the target the Slack portal wraps


