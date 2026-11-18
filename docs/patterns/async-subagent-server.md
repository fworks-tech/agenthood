# Pattern: async subagent server

Source: [langchain-ai/deepagents, examples/async-subagent-server](https://github.com/langchain-ai/deepagents/tree/main/examples/async-subagent-server),
licensed [MIT](https://github.com/langchain-ai/deepagents/blob/main/LICENSE)
(Copyright LangChain, Inc.). This page maps that example onto Agenthood; it is
not a copy of the upstream code.

## What the upstream pattern does

A self-hosted FastAPI server exposes a deepagents researcher as an async
subagent. A supervisor REPL creates threads, starts runs, polls status, and
cancels work over an Agent Protocol HTTP API.

## Mapping to Agenthood

| Upstream primitive | Agenthood equivalent | Status |
|--------------------|----------------------|--------|
| Agent Protocol HTTP server (`POST /threads`, `POST /runs`, `GET /status`) | No HTTP server. Members are invoked through the CLI runtime (`npx agenthood run`, [src/cli.ts](../../src/cli.ts)) or the MCP server ([src/mcp/server.ts](../../src/mcp/server.ts)) | not covered: [Agent Protocol HTTP server](https://github.com/fworks-tech/agenthood/issues/1091) |
| Supervisor delegates to a subagent | Member delegation inside a run: [src/agents/wrappedTaskAgent.ts](../../src/agents/wrappedTaskAgent.ts) and [src/agents/delegationRoles.ts](../../src/agents/delegationRoles.ts) | covered |
| Orchestrated multi-step supervision | Chains: [src/workflows/chains.ts](../../src/workflows/chains.ts) declared in [chains.yaml](../../chains.yaml), run with `npx agenthood workflow run` | covered |
| Status polling endpoint | Run checkpoints and traces: `npx agenthood checkpoints`, `npx agenthood trace` ([src/commands/checkpoints.ts](../../src/commands/checkpoints.ts)) | covered |
| Run cancellation endpoint | No runtime cancel API. Scheduled CI runs replace each other through the workflow concurrency group (see [.github/workflows/rituals.yml](../../.github/workflows/rituals.yml)) | not covered, tracked in the [server issue](https://github.com/fworks-tech/agenthood/issues/1091) |

## What the audit trail changes

The upstream supervisor needs a bespoke status endpoint because the server
keeps no readable record of a run. Here every run writes a decision record, a
provenance entry, and a trace under `.agenthood/`, so a supervisor answers
"what happened" from `agenthood checkpoints` and `agenthood trace` without a
dedicated API. The missing piece is only the remote transport: nothing listens
on a socket.

## Minimal example

The closest runnable equivalent today is a chain run whose progress lands in
checkpoints:

```bash
npx agenthood workflow run build "research the migration path for issue #42"
npx agenthood checkpoints
```

There is no HTTP server to point a supervisor at. Until the
[Agent Protocol server issue](https://github.com/fworks-tech/agenthood/issues/1091)
lands, this page is a reference for the protocol design, not a command.
