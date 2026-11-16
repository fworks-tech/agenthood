# Custom Toolkits

> *The Society's skills are a starting point. Your domain has skills the Society has not written yet.*

---

## What it is

A custom skill is a tool you write that implements the Society's `ISkill` contract, so the agent can use it like a built-in one. The Society covers general software engineering: commits, reviews, tests, security. Your domain has knowledge it has not encoded, such as the query behind your status dashboard, the script that validates your data pipeline, or the API that files a ticket in your issue tracker. A custom skill turns that knowledge into a first-class tool.

Discovery, not registration, is the mechanism. There is no config file to edit and no register function to call. You write a `.ts` file that implements `ISkill`, drop it in the skills directory and restart. `SkillRegistry.discover()` finds it at startup, reads its metadata and adds it to the agent's tools. From there the reasoning loop chooses it the same way it chooses `ReadFileSkill`.

The contract is what makes it safe. `ISkill` defines a name, a description, an input schema and an `execute` method. The name and description are what the reasoning loop sees when it picks a tool. The input schema validates arguments before `execute` runs. `execute` returns a `SkillResult` (success, failure or needs-more-input) that the loop handles uniformly. A skill that skips the contract is never discovered, and one that implements it badly fails at the schema boundary instead of inside the agent's reasoning.

---

## Why it matters in production

Hardcoded side effects are the anti-pattern of agent integration. When an agent's "check the deploy status" logic is a buried `fetch()` call inside a prompt template, three things break: the call cannot be tested in isolation, the result cannot be traced, and the logic cannot be reused by another agent. The skill becomes a hidden coupling between the prompt and the network.

A custom skill fixes all three. It is a unit with a name, a contract and a testable `execute` method. The reasoning loop decides when to call it; the skill decides how to run it. Because the two are separate, the skill can be unit-tested without an LLM, and the reasoning can be evaluated without the skill's network dependency. That separation is what makes it production-grade.

The discovery model scales with the team. A new engineer does not learn a registration framework or edit a shared config; they write a `.ts` file, restart, and every agent has it. Review happens on a self-contained, contract-bound artifact instead of a snippet buried in a prompt.

---

## How Agenthood implements it

The `ISkillManifest` interface and `SkillDiscovery` live in `src/skills/discovery/` (shipped in v2.0.0). Here is a complete skill implementation: a custom tool that checks an internal deploy dashboard:

```typescript
import { ISkillManifest, SkillResult, SkillContext } from 'agenthood';

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

export class DeployStatusSkill implements ISkillManifest<DeployStatusInput, DeployStatusOutput> {
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

Discovery is automatic: drop this file in your project's skills directory and `SkillDiscovery.discover()` finds it on the next startup:

```typescript
import { SkillDiscovery } from 'agenthood';

const discovery = new SkillDiscovery();
await discovery.discover('./src/skills');   // scans for skill manifests

// The custom skill is now available alongside the built-ins
const skill = registry.get('deploy_status');
const result = await skill.execute({ service: 'auth-api', environment: 'production' }, context);
```

The agent's reasoning loop sees `deploy_status` in the tool list with its description and schema. When the user asks "is auth-api healthy in prod?", the loop selects the skill, validates the input against `inputSchema`, calls `execute`, and feeds the typed output back into the next reasoning step. No registration boilerplate, no prompt editing, no hardcoded fetch.

---

## Hands-on example

```bash
# Drop a skill file into the skills directory and restart: that is the entire setup
mkdir -p .agenthood/skills
cp deploy-status.ts .agenthood/skills/
agenthood run builder "is auth-api healthy in production?"
```

The agent discovers the skill and uses it:

```
[think] The user is asking about deploy status. I have a deploy_status skill.
[act]  deploy_status({ service: 'auth-api', environment: 'production' })
[see]  { service: 'auth-api', version: 'v2.3.1', healthy: true, lastDeploy: '2026-06-17T14:22Z' }
[think] auth-api is healthy, running v2.3.1, last deployed 6 hours ago.
[done] auth-api is healthy in production: v2.3.1, deployed 2026-06-17 14:22 UTC.
```

The skill was not registered. It was discovered. The agent chose to call it based on its description matching the user's intent.

---

## Building Your Own Society Member

The margin above shows the code path: a TypeScript class implementing a contract. Since 3.0 the
normal path is a document: a `SKILL.md` with instructions a model follows. Same idea, no build step.

A member is a directory with one file:

```
skills/contrib/the-translator/SKILL.md
```

Four things make it real:

1. **Frontmatter**: `name` (matching the directory), a `description` that front-loads its trigger
   words, `license`, and for a third-party member `metadata.author` plus `source_url`.
2. **Six sections**: Overview, When to Use, Process, Red Flags, Rationalizations, Verification. The
   Sentinel checks for them; a reader relies on them.
3. **Location**: `skills/contrib/` is discovered automatically. In v4 there is no registry file to
   edit, no `register()` call, and no restart.
4. **A lockfile hash**: `agenthood verify --update-lock` records it so drift is detectable.

```bash
mkdir -p skills/contrib/the-translator
$EDITOR skills/contrib/the-translator/SKILL.md
agenthood verify --contrib          # structure, owner, source
agenthood skills                    # listed and not blocked
agenthood run builder "/the-translator summarize docs/spec.md for support"
```

A community member is listed in the README once it is reviewed and its `SKILL.md` is valid: CI
checks both. The full walkthrough, including a complete worked example, is
[Creating a Member](../../guides/creating-a-member.md); the contract and trust model are
[Third-Party Members](../../members/contrib-members.md).

**When to write code instead.** A document cannot call an API. If the member's job is to *fetch* or
*compute* rather than to *decide how*, write a bundled script under `scripts/` (it runs in Docker by
default) or a code skill as above. Prefer instructions; reach for code only when the work needs it.

---

## Further reading

- [`src/skills/discovery/ISkillManifest.ts`](../../../src/skills/discovery/ISkillManifest.ts): the skill contract every custom skill implements (v2.0.0)
- [`src/skills/discovery/SkillDiscovery.ts`](../../../src/skills/discovery/SkillDiscovery.ts): dynamic discovery via `SkillDiscovery.discover()` (v2.0.0)
- [JSON Schema](https://json-schema.org/): the input validation standard `inputSchema` uses
- [Creating a Member](../../guides/creating-a-member.md): the document path, step by step


