# Pattern: content builder agent

Source: [langchain-ai/deepagents, examples/content-builder-agent](https://github.com/langchain-ai/deepagents/tree/main/examples/content-builder-agent),
licensed [MIT](https://github.com/langchain-ai/deepagents/blob/main/LICENSE)
(Copyright LangChain, Inc.). This page maps that example onto Agenthood; it is
not a copy of the upstream code.

## What the upstream pattern does

A content agent built from three definition primitives: persistent brand voice
in `AGENTS.md`, on-demand skills per content type in `skills/*/SKILL.md`, and
delegated subagents in `subagents.yaml`. A research, write, and image pipeline
produces a post and a Gemini-generated cover image.

## Mapping to Agenthood

| Upstream primitive | Agenthood equivalent | Status |
|--------------------|----------------------|--------|
| `AGENTS.md` for persistent brand voice | `AGENTS.md` project instructions, loaded by the opencode plugin and the integrity checks ([src/agents/memberLore.ts](../../src/agents/memberLore.ts), [src/core/ExecutionContext.ts](../../src/core/ExecutionContext.ts)) | covered |
| On-demand skill loading per content type | Skill activation and catalog: [src/skills/activation/](../../src/skills/activation/), [src/skills/registry/](../../src/skills/registry/) | covered |
| Subagents declared in `subagents.yaml` | Chains of members in [chains.yaml](../../chains.yaml) ([src/workflows/chains.ts](../../src/workflows/chains.ts)); custom members registered in code ([Custom members](../../README.md#custom-members)) | partial: no per-task subagent YAML; chains sequence members instead |
| Research, write, image pipeline | Text stages run as a chain; there is no image generation primitive in the runtime | not covered: [image generation issue](https://github.com/fworks-tech/agenthood/issues/1092) |
| Cover image via Gemini | Nothing. The runtime ships text and decision models only | not covered: same [image generation issue](https://github.com/fworks-tech/agenthood/issues/1092) |

## What the audit trail changes

The upstream example's pipeline lives in one script, so a bad paragraph has no
history. Here each stage is a member run: the research run, the writing run,
and the review run each leave a decision record with what they rejected, and
the provenance chain makes a later edit of that record visible. A content
pipeline becomes a sequence you can audit stage by stage with
`agenthood trace`.

## Minimal example

A content pipeline as a chain, using the declared members:

```bash
npx agenthood workflow run planning "draft the launch post for v4.1 from the release notes"
npx agenthood trace
```

The text stages run end to end. The image stage does not exist yet: that is
the [image generation issue](https://github.com/fworks-tech/agenthood/issues/1092),
not an omitted detail.
