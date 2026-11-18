# Pattern: deploy coding agent

Source: [langchain-ai/deepagents, examples/deploy-coding-agent](https://github.com/langchain-ai/deepagents/tree/main/examples/deploy-coding-agent),
licensed [MIT](https://github.com/langchain-ai/deepagents/blob/main/LICENSE)
(Copyright LangChain, Inc.). This page maps that example onto Agenthood; it is
not a copy of the upstream code.

## What the upstream pattern does

An autonomous coding agent deployed as an API. Given a task, it plans,
implements, tests, and commits inside a LangSmith sandbox with full shell
access, following a plan, implement, review, deliver workflow, with skills for
code review, coding preferences, and planning.

## Mapping to Agenthood

| Upstream primitive | Agenthood equivalent | Status |
|--------------------|----------------------|--------|
| Plan, implement, review, deliver workflow | The `build` chain in [chains.yaml](../../chains.yaml): tester, builder, reviewer, doorman ([src/workflows/chains.ts](../../src/workflows/chains.ts)) | covered |
| Coding skills (review, prefs, planning) | Members with checklists: [The Reviewer](../../docs/members/the-reviewer/), [The Builder](../../docs/members/the-builder/), [The Architect](../../docs/members/the-architect/) | covered |
| Coding agent over a repository | `The Builder` runs through the ReAct loop with file and shell tools ([src/agents/DeveloperAgent.ts](../../src/agents/DeveloperAgent.ts), [src/reasoning/ReActLoop.ts](../../src/reasoning/ReActLoop.ts)) | covered |
| HTTP API deployment | No HTTP server; members run through the CLI runtime ([src/cli.ts](../../src/cli.ts)) | not covered: the [Agent Protocol server issue](https://github.com/fworks-tech/agenthood/issues/1091) |
| Sandboxed shell execution | No sandbox. Tool permission profiles ([restricted](../../README.md#custom-members)) narrow what a member may call, but execution happens on the host with host credentials | partial, and the sandbox gap is tracked in the [sandbox issue](https://github.com/fworks-tech/agenthood/issues/1093) |

## What the audit trail changes

Upstream, "deliver" is the sandbox returning a patch, and trust comes from the
isolation of the box. Here the runtime runs on a host you own, so the trust
moves to the record and the gate: every planning and building run leaves
decisions and provenance under `.agenthood/`, and nothing merges on a model
verdict, only on the deterministic checks ([ADR-046](../adr/ADR-046-automated-review-authority.md)).
A deployed coding agent on this runtime is auditable after the fact in a way a
sandbox does not need to be, and gated before the fact in a way a sandbox
cannot be.

## Minimal example

The build chain against a real issue, with the gate enforced at the end:

```bash
npx agenthood workflow run build "implement issue #42"
```

The HTTP deployment and the sandbox do not exist. Until the
[server](https://github.com/fworks-tech/agenthood/issues/1091) and
[sandbox](https://github.com/fworks-tech/agenthood/issues/1093) issues land,
this page is a reference architecture, not a command to serve one.
