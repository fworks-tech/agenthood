# Custom Toolkits

> *The Society's 14 skills are a starting point. Your domain has skills the Society has not written yet.*

---

## What it is

A custom skill is a tool you write that implements the Society's `ISkill` contract, so your agent can use it exactly like the built-in skills. The Society ships 14 members covering general software-engineering domains — commits, reviews, tests, security. Your domain has knowledge the Society has not encoded: the query that checks your internal status dashboard, the script that validates your data pipeline, the API that files a ticket in your custom issue tracker. Custom skills are how that knowledge becomes a first-class agent tool.

The mechanism is discovery, not registration. You do not edit a config file or call a register function. You write a `.ts` file that implements `ISkill`, drop it into the skills directory, and restart. `SkillRegistry.discover()` finds it at startup, reads its metadata, and adds it to the agent's available tools. The skill is now indistinguishable from a built-in — the agent's reasoning loop can choose to call it the same way it chooses to call `ReadFileSkill`.

The contract is what makes this safe. `ISkill` defines a name, a description, an input schema, and an `execute` method. The name and description are what the agent's reasoning sees when deciding which tool to call. The input schema is a JSON Schema that validates arguments before `execute` runs. The `execute` method returns a `SkillResult` — success, failure, or needs-more-input — that the loop handles uniformly. A skill that does not implement the contract is not discovered; a skill that implements it incorrectly fails at the schema boundary, not inside the agent's reasoning.

---

## Why it matters in production

Hardcoded side effects are the anti-pattern of agent integration. When an agent's "check the deploy status" logic is a buried `fetch()` call inside a prompt template, three things break: the call cannot be tested in isolation, the result cannot be traced, and the logic cannot be reused by another agent. The skill becomes a hidden coupling between the prompt and the network.

Custom skills fix all three. A skill is a unit — it has a name, a contract, and a testable `execute` method. The agent's reasoning decides *when* to call it; the skill decides *how* to execute it. The two are separate, which means the skill can be unit-tested without an LLM, and the agent's reasoning can be evaluated without the skill's network dependency. This separation is what makes custom skills production-grade instead of prototype-grade.

The discovery model also matters for team scaling. When a new engineer joins, they do not need to learn a registration framework or edit a shared config. They write a `.ts` file in the skills directory, and on the next restart it is available to every agent. The skill is the unit of contribution — and code review on a skill file is review on a self-contained, contract-bound artifact, not on a snippet buried in a prompt.

---

## How Agenthood implements it

The `ISkill` interface and `SkillRegistry` live in `src/skills/` (coming in v2.0.0). Here is a complete `ISkill` implementation — a custom skill that checks an internal deploy dashboard:

```typescript
import { ISkill, SkillResult, SkillContext } from 'agenthood';

interface DeployStatusInput {
  service: string;
  environment: 'staging' | 'production';
}

interface DeployStatusOutput {
  service: string;
  environment: string;
  version: string;
  healthy: boolean;
  lastDeploy: string;
}

export class DeployStatusSkill implements ISkill<DeployStatusInput, DeployStatusOutput> {
  name = 'deploy_status';
  description = 'Check the deployment status and health of a service in a given environment. Use when the user asks whether a service is deployed, healthy, or running a specific version.';
  inputSchema = {
    type: 'object',
    properties: {
      service:      { type: 'string', description: 'The service name, e.g. "auth-api".' },
      environment:  { type: 'string', enum: ['staging', 'production'] },
    },
    required: ['service', 'environment'],
  } as const;

  async execute(input: DeployStatusInput, context: SkillContext): Promise<SkillResult<DeployStatusOutput>> {
    const url = `${context.config.dashboardUrl}/api/services/${input.service}/${input.environment}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${context.config.dashboardToken}` } });

    if (!res.ok) {
      return {
        status: 'failure',
        error: `Dashboard returned ${res.status}: ${await res.text()}`,
      };
    }

    const data = await res.json() as DeployStatusOutput;
    return {
      status: 'success',
      output: data,
    };
  }
}
```

Discovery is automatic — drop this file in `src/skills/` (or your project's skills directory) and `SkillRegistry.discover()` finds it on the next startup:

```typescript
import { SkillRegistry } from 'agenthood';

const registry = new SkillRegistry();
await registry.discover('./src/skills');   // scans for ISkill implementations

// The custom skill is now available alongside the built-ins
const skill = registry.get('deploy_status');
const result = await skill.execute({ service: 'auth-api', environment: 'production' }, context);
```

The agent's reasoning loop sees `deploy_status` in the tool list with its description and schema. When the user asks "is auth-api healthy in prod?", the loop selects the skill, validates the input against `inputSchema`, calls `execute`, and feeds the typed output back into the next reasoning step. No registration boilerplate, no prompt editing, no hardcoded fetch.

---

## Hands-on example

```bash
# Drop a skill file into the skills directory and restart — that is the entire setup
mkdir -p .agenthood/skills
cp deploy-status.ts .agenthood/skills/
agenthood run the-developer "is auth-api healthy in production?"
```

The agent discovers the skill and uses it:

```
[think] The user is asking about deploy status. I have a deploy_status skill.
[act]  deploy_status({ service: 'auth-api', environment: 'production' })
[see]  { service: 'auth-api', version: 'v2.3.1', healthy: true, lastDeploy: '2026-06-17T14:22Z' }
[think] auth-api is healthy, running v2.3.1, last deployed 6 hours ago.
[done] auth-api is healthy in production — v2.3.1, deployed 2026-06-17 14:22 UTC.
```

The skill was not registered. It was discovered. The agent chose to call it based on its description matching the user's intent.

---

## Further reading

- [`src/skills/ISkill.ts`](../../src/skills/ISkill.ts) — the skill contract every custom skill implements (v2.0.0)
- [`src/skills/SkillRegistry.ts`](../../src/skills/SkillRegistry.ts) — dynamic discovery via `SkillRegistry.discover()` (v2.0.0)
- [JSON Schema](https://json-schema.org/) — the input validation standard `inputSchema` uses

---

## LinkedIn version

**Hook:** Every domain has knowledge the Society has not encoded yet. `ISkill` is the interface that lets you encode it.

**Why it matters:**
- Custom skills integrate domain logic as first-class agent tools — not hardcoded side effects
- `SkillRegistry.discover()` finds skills at startup — no registration boilerplate
- Your custom skill becomes a Society-standard tool the moment it implements `ISkill`

**→** [Read the full article →](https://agenthood.flabs.tech/academy/level-3-advanced-skills/03-custom-toolkits/)
