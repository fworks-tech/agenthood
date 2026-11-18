# Patterns

Workflow patterns ported from the [deepagents](https://github.com/langchain-ai/deepagents)
examples, mapped onto the Society. The upstream repository is
[LangChain's deepagents](https://github.com/langchain-ai/deepagents/tree/main/examples),
licensed [MIT](https://github.com/langchain-ai/deepagents/blob/main/LICENSE)
(Copyright LangChain, Inc.). These pages attribute each pattern to its source
folder, map every upstream primitive to what exists here, and name what is not
covered instead of inventing an equivalent.

Every page has a three column table: the primitive in the upstream example, the
equivalent in this repository with a real file path, and a status. Status
values:

- **covered**: the repository has the capability today, and the page points at
  the file or command that provides it.
- **partial**: a narrower version exists; the page says what is missing.
- **not covered**: nothing provides it here. Each one carries an open issue
  instead of a pretended equivalent.

The mapping matters because of the audit trail. Each adoption note on every
page says how decision records, provenance, and traces change what the pattern
means when it runs here.

| Pattern | Upstream source | Page |
|---------|-----------------|------|
| Async subagent server | [examples/async-subagent-server](https://github.com/langchain-ai/deepagents/tree/main/examples/async-subagent-server) | [async-subagent-server.md](async-subagent-server.md) |
| Content builder agent | [examples/content-builder-agent](https://github.com/langchain-ai/deepagents/tree/main/examples/content-builder-agent) | [content-builder-agent.md](content-builder-agent.md) |
| Deploy coding agent | [examples/deploy-coding-agent](https://github.com/langchain-ai/deepagents/tree/main/examples/deploy-coding-agent) | [deploy-coding-agent.md](deploy-coding-agent.md) |
| Deploy content writer | [examples/deploy-content-writer](https://github.com/langchain-ai/deepagents/tree/main/examples/deploy-content-writer) | [deploy-content-writer.md](deploy-content-writer.md) |

Issues for the not-covered capabilities are linked from the pages that name
them.
