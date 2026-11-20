# ADR-051: Per-Server readOnly Grants for Restricted Members

**Date:** 2026-11-20
**Status:** Accepted
**Supersedes:** None
**Amends:** ADR-047 (section 4, MCP tools are WRITE-level)

## Context

ADR-047 section 4 classifies every MCP tool as WRITE, so `restricted` members get none, even with
a declaration. ADR-047's alternatives table explicitly rejects a per-server `readOnly` flag "for
this ADR", deferring it. Hosts now need read-only external access for restricted members (e.g. a
lookup tool that cannot mutate state), so the deferral is lifted. The host, not the server, makes
the trust assertion: the server's tool list does not say whether a tool mutates state.

## Decision

**1. `readOnly?: boolean` per server.** Default `false`. When `true`, every tool that server exposes
is classified as READ-level for permission purposes, so `restricted` members may receive it.

**2. Host assertion, not server claim.** The runtime trusts the config author. A `readOnly` server
whose tool actually mutates state is a misconfiguration by the host; the runtime cannot verify it.
The ADR and the runtime-guide must state this plainly.

**3. Interaction with the intersection rule.** The profile gate changes from "carries `mcp`" to
"carries `mcp` OR (server is `readOnly` AND profile carries `mcp_readonly`)". `restricted` gains a
new capability token `mcp_readonly`; `standard` and `trusted` keep `mcp` (which implies read+write).
`MemberRegistry.intersectDeclaredTools` receives the server's readOnly flag per tool and applies the
right capability. The `mcp` capability token remains separate from tool names.

**4. MemberAgent classification.** `isToolPermitted` consults the server's readOnly flag for `mcp.*`
tools: a readOnly server's tools are READ-level (allowed for every profile), a non-readOnly
server's tools stay WRITE-level (standard/trusted only). The server flag is threaded from config
through `McpSession` into `MemberAgentOptions`.

**5. Config validation.** `readOnly` must be a boolean if present; any other type fails config
load before spawn/connect.

## Alternatives Considered

| Option | Pros | Cons | Why Rejected |
|---|---|---|---|
| Server declares read-only per tool | Accurate | Server is not the trust boundary; spoofable | Rejected: host decides trust |
| Separate `readOnlyTools` allowlist | Fine-grained | Two sources of truth for one decision | Rejected: server-level is simpler and matches the host's mental model |
| Keep WRITE-only (ADR-047) | Simple | Blocks legitimate read-only use cases | Rejected: the deferral is lifted by demand |

## Consequences

- ADR-047 section 4 is amended, not rewritten; ADR-047 stays Accepted.
- `restricted` members gain external read access only when the host opts in per server.
- The trust assertion is documented as host responsibility; the runtime does not verify it.

## References

- [ADR-047](ADR-047-mcp-client-scope.md): section 4 (amended) and the intersection rule.
- [ADR-041](ADR-041-member-tool-permission-model.md): capability tokens and classification.
