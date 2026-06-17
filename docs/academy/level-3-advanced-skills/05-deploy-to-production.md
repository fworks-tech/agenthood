# Deploy to Production

> *An agent that works on your machine is a prototype. An agent that works for your users is a product.*

---

## What it is

Deploying an agent to production is the step that turns a working prototype into a service real users depend on. It is not "run the agent on a server." It is the set of concerns that only exist when multiple users, with different permissions, hitting rate limits, expecting uptime, are involved.

The production layer has three parts. An **API** that exposes the agent as an HTTP endpoint — so users and other systems can call it without a CLI. **Auth middleware** that identifies the caller and scopes what they can access — so one user's agent run cannot read another user's context. **Rate limiting** that bounds how many requests a user can make in a window — so one runaway client does not exhaust the LLM budget for everyone.

These are the same concerns as any production API, plus one that is agent-specific: per-user context isolation. A multi-tenant agent must not share memory between users. User A's episodic memory, project memory, and long-term facts must be scoped to user A. Sharing memory across users is not a performance optimization — it is a security boundary violation. The v3.0.0 API layer enforces this at the memory tier, not at the API edge, so the isolation holds even if the API is bypassed.

---

## Why it matters in production

Most agent demos never become products. The gap is not capability — a demo agent that writes code is already capable. The gap is auth, rate limits, and the runbook you did not write.

Auth is the first failure. An agent with no auth is an open endpoint that can run arbitrary reasoning against your LLM budget. The first user to discover it will not be friendly. Auth is not a feature to add later — it is the boundary between "internal tool" and "product," and it must exist on day one of production.

Rate limiting is the second. An agent that can be called without limit will be called without limit — by a buggy client, by a script in a loop, by an attacker. Each call costs tokens. Without rate limiting, one client can spend your entire monthly LLM budget in an afternoon. Rate limiting protects both your budget and the other users who share it.

The runbook is the one teams skip and regret. What do you do when the agent starts returning errors at 3am? When the LLM provider is down? When a user reports a wrong answer? Without a runbook, the answer is "page someone who guesses." The runbook is the difference between a service you operate and a service that operates you.

---

## How Agenthood implements it

The v3.0.0 API layer (planned, tracked in the [M9 — Platform milestone](https://github.com/fworks-tech/agenthood/milestone/11) and the [M4 — Foundation milestone](https://github.com/fworks-tech/agenthood/milestone/3)) ships the production scaffold. The API is Express-based, with auth and rate limiting as composable middleware:

```typescript
import { AgenthoodAPI, AuthMiddleware, RateLimitMiddleware } from 'agenthood';

const api = new AgenthoodAPI({
  agents: [new DeveloperAgent(), new ReviewerAgent(), new ScribeAgent()],
  memory: { isolation: 'per-user' },   // enforced at the memory tier
});

api.use(new AuthMiddleware({ strategy: 'jwt', audience: 'agenthood-api' }));
api.use(new RateLimitMiddleware({
  window: '1m', max: 20,               // 20 requests per minute per user
  burst: 5,                             // allow short bursts above the steady-state limit
}));

api.post('/agents/:name/run', async (req, res) => {
  const { name } = req.params;
  const { task } = req.body;
  const userId = req.auth.userId;       // scoped by AuthMiddleware

  const agent = api.agents.get(name);
  const result = await agent.run(task, { userId });  // memory isolated per userId
  res.json(result);
});

api.listen(3000);
```

The `memory: { isolation: 'per-user' }` setting is the agent-specific part. It tells the memory tiers from Level 2 article 05 to namespace every read and write by `userId`. User A's episodic memory query returns only user A's past runs. User B's project memory holds only user B's codebase index. The isolation is enforced at the memory layer, so even a bug in the API routing cannot leak context across users.

---

## Hands-on example

```bash
# Once the v3.0.0 API ships, deploy and call it like any HTTP service
agenthood serve --port 3000

# Authenticated request — the agent runs scoped to the caller
curl -X POST https://api.yourapp.com/agents/the-developer/run \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d '{"task": "refactor the auth middleware to use async/await"}'
```

Response:

```json
{
  "agent": "the-developer",
  "userId": "usr_8f3a",
  "output": "Refactored src/middleware/auth.ts to use async/await. 3 functions updated, 0 behavior changes.",
  "steps": 7,
  "cost": { "inputTokens": 1840, "outputTokens": 220, "totalCost": 0.0018 },
  "memoryScope": "usr_8f3a"
}
```

The `memoryScope` field is the proof of isolation — the run's memory was scoped to `usr_8f3a`, and no other user's context was accessible. The cost is reported per request, so the operator sees spend in real time.

---

## Operational runbook

The production runbook for an Agenthood deployment covers the failure modes that matter:

1. **LLM provider down** — `ProviderFailover` (see Level 3 article 04) routes to the next provider automatically. Verify the failover chain is configured before deploying.
2. **Agent looping forever** — `ThinkingBudget` (see Level 2 article 11) terminates the loop at the configured step/token limit. Set the budget per agent, not globally.
3. **User reports wrong answer** — pull the run's trace (every reasoning step and tool call is logged) and the eval scores for that case. The trace is the artifact; the eval baseline is the comparison.
4. **Cost spike** — `CostEstimator` aggregates per-user and per-agent spend. Alert on any user exceeding 2x their 7-day average.
5. **Memory leak across users** — this should be impossible (isolation is enforced at the memory tier), but if reported, check the `userId` propagation in the API middleware and the memory tier's namespace config.

---

## Further reading

- [M4 — Foundation milestone](https://github.com/fworks-tech/agenthood/milestone/3) — the base infrastructure milestone
- [M9 — Platform milestone](https://github.com/fworks-tech/agenthood/milestone/11) — the API and multi-tenancy milestone
- [The Twelve-Factor App](https://12factor.net/) — production deployment principles that apply to agent services too

---

## LinkedIn version

**Hook:** Most agent demos never become products. The gap is not capability — it is auth, rate limits, and the runbook you did not write.

**Why it matters:**
- Multi-tenant agents need per-user context isolation — shared memory is a security boundary
- Rate limiting protects your LLM budget and your users from runaway loops
- Agenthood's v3.0.0 API layer is the production scaffold you do not have to build yourself

**→** [Read the full article →](https://agenthood.flabs.tech/academy/level-3-advanced-skills/05-deploy-to-production/)
