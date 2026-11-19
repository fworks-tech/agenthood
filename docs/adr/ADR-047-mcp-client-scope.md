# ADR-047: MCP Client Scope and Per-Member Tool Grants

**Date:** 2026-11-19
**Status:** Accepted
**Supersedes:** None
**Amends:** ADR-041 (adds a classification for MCP tools)

## Context

The runtime ships an MCP server (`src/mcp/server.ts`, `agenthood mcp`) but no MCP client. A member
cannot receive tools from an external MCP server, so a host that embeds Agenthood either grants a
member a shell or grants nothing. Issue #1072 asks for the missing client half, scoped per member and
fail-closed like the existing `allowed-tools` intersection (ADR-041).

ADR-041 fixes three rules that the client must keep: effective tools are the intersection of the
declaration and the profile grant, unclassified tools are denied for every profile, and a skill may
only narrow. An external server adds two risks ADR-041 did not face: the server's tool list is not
known until the server runs, and a tool call reaches a system outside the runtime, so its effect is
not reversible by the runtime.

## Decision

**1. Only the host declares servers.** `.agenthood/config.json` takes an `mcpServers` block. Each entry
has a `command` (non-empty string) and an optional `args` (array of strings, default `[]`). The server
name must match `[a-z0-9][a-z0-9-]*`, because it is part of the tool name. Unknown keys, an empty
command, a non-array `args`, or an invalid name fail the config load before any process starts. A
`SKILL.md` cannot declare or spawn a server: an `mcpServers` key in its frontmatter is ignored with a
warning and nothing is registered.

**2. A member names MCP tools in `allowed-tools`.** The declared form is `mcp.<server>.<tool>`. The
form the model sees is `mcp__<server>__<tool>`. The server name excludes `__`, so the split is
unambiguous. A server tool name that cannot be expressed as a provider function name
(`^[A-Za-z0-9_-]{1,64}$`) is not registered. MCP names never enter `TOOL_VOCABULARY`.

**3. The intersection rule.** For a member, the effective MCP tools are:

    declared ∩ (profile grant ∪ server allowlist, the latter only when the profile carries the `mcp` capability)

`MemberRegistry.intersectDeclaredTools(declared, permission, grants = toolsByProfile[permission])` is the
only function that computes this. The `mcp` capability token is not a tool name: it lives in its own
table and is never returned in the result. `standard` and `trusted` carry `mcp`; `restricted` does not.
The server allowlist is the set of names the server returns from `tools/list`; a tool that the server
does not list cannot be granted. Narrowing by the profile stays silent, as it is for every other tool,
and `MemberAgent` keeps its existing warning.

Reason: the declaration narrows, the profile decides whether external tools exist for the member at
all, and the server decides which tools exist. Each side can only remove, so no single side widens
the grant.

**4. MCP tools are WRITE-level (amends ADR-041).** `MemberAgent.isToolPermitted` classifies every
`mcp.*` tool as WRITE: it needs `standard` or `trusted`. A server tool can change state in a system
the runtime cannot inspect, so a restricted member gets none, even when its declaration names one.
This is the same reason ADR-041 puts `code.write` above `restricted`.

**5. Lazy start, before the first model call.** A run starts only the servers that the selected
member's declared tools reference. It performs the handshake and `tools/list` before the first LLM
call. A server that no member of the run references is never spawned.

**6. Transport.** STDIO only, newline-delimited JSON-RPC 2.0, one process per server per run. The
process is spawned with `shell: false` and the args array as given. The child environment is limited
to `PATH` and the platform essentials (`SystemRoot`, `HOME`, `USERPROFILE`, `TEMP`, `TMP`) from the
parent. No `env` key exists in config. Handshake and each call are bounded by a timeout (10 s for
start, 30 s per call).

**7. Fail-closed at four points.** Each point has its own explicit error:

| Point | Behavior | Error names |
|---|---|---|
| Server fails to start (spawn error, handshake error, start timeout) | The run fails before the first model call. | The server and the reason. |
| Member declares a tool the server does not expose, or names an unconfigured server | The run fails before the first model call. | The member and the tool. |
| Server dies or its pipe closes mid-run | The next call and the run fail. The ReAct loop rethrows `McpServerError` instead of returning it to the model. No restart. | The server and its exit status. |
| A tool call returns an error (`isError`, JSON-RPC error, or per-call timeout) | Returned to the model as a tool error labelled with the server and tool, as any tool error. The run continues. | The server and the tool. |

Only the fourth point is recoverable by the model, because the server is still alive and the error is
the tool's own answer. A dead server is never silently survived.

**8. Shutdown.** Every session closes in the `finally` of the member run, on success and on error. A
process-level hook kills every live child on `exit`, `SIGINT` and `SIGTERM`. An orphan process is a
defect.

**9. What the trace records.** Each event is one decision in `.agenthood/decisions` with one provenance
entry in `.agenthood/provenance` linked by `metadata.decisionId`, the same shape a run uses. The events
are: servers started (name, tool count), the tools granted to the member, each invocation (server, tool,
outcome), and each fail-closed error. The record holds the tool name and outcome. It does not
hold arguments or results, because a tool call may carry secrets; the shared redactor guards the rest.
Decisions carry the tag `mcp`.

## Alternatives Considered

| Option | Pros | Cons | Why Rejected |
|---|---|---|---|
| Add MCP tool names to `TOOL_VOCABULARY` | One table | The vocabulary is closed and maps to implementation classes; server tools are not known at build time | Rejected: a closed set cannot hold a dynamic one |
| Let `SKILL.md` declare servers | Self-contained skills | A skill that spawns a process grants itself a shell | Rejected: the host is the trust boundary |
| Bypass `MemberAgent` for MCP tools | Simplest path | A second permission route beside ADR-041 | Rejected: one gate is auditable |
| Per-server `readOnly` flag in config | Read-only servers reach restricted members | A second classification source, and the author of the config decides the trust level | Rejected for this ADR; revisit when a host needs it |
| Restart a dead server | Run continues | The model may act on partial state, and a restart hides the failure | Rejected: fail-closed |

## Consequences

- Absent `mcpServers`, behavior is identical to 4.4.0: no config is read for servers, no process is
  spawned, and no tool name changes.
- A restricted member cannot use an MCP tool even with a declaration. Hosts that want read-only
  external access must wait for the per-server flag, which is out of scope here.
- Each MCP event adds one decision and one provenance write. Writes are sequential, so the provenance
  hash chain keeps its order.
- The client is a small in-tree JSON-RPC implementation. The `@modelcontextprotocol/server` package in
  this repo ships no client and no stdio server transport. A future client package would replace the
  implementation without changing the config, the intersection or the trace.
- Hosted transports (HTTP, URL), remote auth, tool-list caching and incremental refresh stay out of
  scope.

## References

- [ADR-041](ADR-041-member-tool-permission-model.md): the permission model this narrows against and
  the classification this amends.
- [ADR-028](ADR-028-skill-frontmatter-contract.md): `allowed-tools` parsing.
- [ADR-032](ADR-032-skill-tool-enforcement.md): call-time enforcement in `ReActLoop`.
- [ADR-015](ADR-015-decision-intelligence-and-provenance.md): decision and provenance records.
- `src/members/MemberRegistry.ts` (`intersectDeclaredTools`), `src/members/MemberAgent.ts`
  (`isToolPermitted`), `src/commands/config.ts` (config parsing), `src/mcp/server.ts` (server side, unchanged).
- Issue #1072; host use case: Atlaslink#109.
