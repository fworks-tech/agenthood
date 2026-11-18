# Pattern: deploy content writer

Source: [langchain-ai/deepagents, examples/deploy-content-writer](https://github.com/langchain-ai/deepagents/tree/main/examples/deploy-content-writer),
licensed [MIT](https://github.com/langchain-ai/deepagents/blob/main/LICENSE)
(Copyright LangChain, Inc.). This page maps that example onto Agenthood; it is
not a copy of the upstream code.

## What the upstream pattern does

A content writing agent deployed as an API that writes blog posts, LinkedIn
posts, and tweets, with memory scoped per user through Supabase auth
(`/memories/user/preferences.md`), and skills per content type.

## Mapping to Agenthood

| Upstream primitive | Agenthood equivalent | Status |
|--------------------|----------------------|--------|
| Skills per content type (blog post, social media) | Skill activation per task: [src/skills/activation/](../../src/skills/activation/), catalog in [src/skills/catalog/](../../src/skills/catalog/) | covered |
| Text pipeline (research, draft, review) | A chain of members in [chains.yaml](../../chains.yaml), run with `npx agenthood workflow run` | covered |
| Per-user memory behind auth (`/memories/user/...`) | Project-scoped memory only: [src/memory/ProjectMemory.ts](../../src/memory/ProjectMemory.ts), [src/memory/LongTermMemory.ts](../../src/memory/LongTermMemory.ts). There is no user identity in the memory paths | not covered: [per-user memory issue](https://github.com/fworks-tech/agenthood/issues/1094) |
| Deployment as an authenticated API | No HTTP server and no application-user auth. Provider auth (LLM keys) is the only credential surface ([providers](../../README.md#compatibility)) | not covered: same [per-user memory issue](https://github.com/fworks-tech/agenthood/issues/1094), transport in the [server issue](https://github.com/fworks-tech/agenthood/issues/1091) |

## What the audit trail changes

Per-user memory makes "whose fact is this" the first question of a
multi-tenant agent. The upstream example answers it with auth-scoped paths and
nothing else. The audit trail here does not replace isolation, but it changes
the failure mode: memories feed runs, runs write decision records with
provenance, so a wrong personalization is traceable to the memory and the run
that consumed it, instead of being silently baked into the next post. Isolation
itself is still missing, and pretending `ProjectMemory` is multi-tenant would
leak one user's preferences into another's output.

## Minimal example

There is none for the deployed shape: this page is a reference architecture,
not a command. The runnable core is the text pipeline without users:

```bash
npx agenthood run strategist "outline a launch post for the v4.1 release"
```

The per-user isolation and the authenticated deployment are the
[per-user memory issue](https://github.com/fworks-tech/agenthood/issues/1094)
and the [Agent Protocol server issue](https://github.com/fworks-tech/agenthood/issues/1091).
