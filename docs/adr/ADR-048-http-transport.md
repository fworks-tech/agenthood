# ADR-048: HTTP Transport for Host-Declared MCP Servers

**Date:** 2026-11-20
**Status:** Accepted
**Supersedes:** None
**Amends:** None

## Context

ADR-047 restricts MCP clients to STDIO. A host that wants to reach a server running elsewhere
(another process, a container, a remote service) cannot do so without a shell wrapper that bridges
STDIO to HTTP, which defeats the "no shell" rule and hides failure modes. The runtime already
speaks JSON-RPC 2.0; only the framing and connection differ.

## Decision

**1. Two transports, one client.** A server entry declares `transport: "stdio" | "http"` (default
`"stdio"`). A common `McpTransport` interface exposes `start`, `request`, `notify` and `close`; `McpStdioClient`
becomes `McpClient` driven by the selected transport. The existing STDIO behavior (newline-delimited
JSON-RPC, 10 s start / 30 s call timeouts, fail-closed) is unchanged.

**2. Streamable HTTP.** The HTTP transport follows the MCP Streamable HTTP spec: a single endpoint URL,
requests as `POST application/json`, responses either a single JSON-RPC object or an `text/event-stream`
whose `message` events carry JSON-RPC objects. The client sends `Accept: application/json, text/event-stream`
and, when the server returns one, stores and resends the `Mcp-Session-Id` header on every subsequent
request. `GET`/`DELETE` session management is not required for v1; the server may close a session and
the client treats the next request as a fresh initialize.

**3. Config shape.** An HTTP entry has `transport: "http"`, `url` (a valid `http:` or `https:` URL),
and optional `headers: Record<string,string>`. Fields that belong to the other transport are
rejected before any request: `command`, `args` and `env` are forbidden on an HTTP entry, and
`url` and `headers` are forbidden on a stdio entry. `headers` values may contain `${env:VAR}`
(ADR-049); literal values are allowed for non-secret keys.

**4. Timeouts and failure.** Start (initialize + tools/list) is bounded by 10 s, each call by 30 s,
matching stdio. A connection refused, a non-2xx response, a malformed body, or a timeout fails the
run before the first model call for start, or fails the call (and the run, if the server is dead) for
invocation. HTTP is never silently retried; the model sees the error only when the server is alive.

**5. No auth in this ADR.** Authentication is added by ADR-049 as env-substituted headers; this ADR
defines only the transport and the `headers` slot.

## Alternatives Considered

| Option | Pros | Cons | Why Rejected |
|---|---|---|---|
| SSE transport (legacy) | Simpler | Deprecated by MCP; two transports to maintain | Rejected: Streamable HTTP supersedes it |
| A separate HTTP client class | Clear split | Duplicates handshake, timeouts, audit | Rejected: one client, pluggable transport |
| Per-request new connection | Stateless | Loses `Mcp-Session-Id`, re-initializes every call | Rejected: session id is part of the protocol |
| WebSocket | Bidirectional | Not in the MCP spec for clients | Rejected: out of spec |

## Consequences

- STDIO behavior and tests are unchanged; the refactor only moves framing behind `McpTransport`.
- `client.ts` grows; the 500-line filesize limit is respected by splitting transport files.
- A remote server's availability becomes a run dependency; fail-closed applies exactly as in ADR-047.
- Cache (ADR-050) applies to both transports using the same key shape.

## References

- [ADR-047](ADR-047-mcp-client-scope.md): scope, intersection, fail-closed.
- [ADR-049](ADR-049-remote-auth-via-env-headers.md): auth via env-substituted headers.
- [ADR-050](ADR-050-tool-list-cache.md): tool-list cache.
- MCP Streamable HTTP specification.
