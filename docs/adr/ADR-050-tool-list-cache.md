# ADR-050: Tool-List Cache for Host-Declared MCP Servers

**Date:** 2026-11-20
**Status:** Accepted
**Supersedes:** None
**Amends:** None

## Context

Every run performs `tools/list` on each started server before the first model call (ADR-047). For a
stable server this is wasted work and adds latency and a failure point to every run. A cache can
skip it when nothing that affects the tool list has changed, while still failing closed when the
server's reality diverges from the cache.

## Decision

**1. Cache location and shape.** A JSON file per server under `.agenthood/mcp-cache/<key>.json`, where
`<key>` is the first 16 hex chars of a SHA-256. The file holds `{ version, key, fetchedAt, tools: McpToolInfo[] }`.
The directory is created on first use; a missing cache is not an error.

**2. Cache key.** SHA-256 of a canonical JSON object containing: `transport`, `command`+`args` (stdio)
or `url` (http), the sorted list of header *names* (http), and the SHA-256 of the concatenated
header *values* (so a rotated secret changes the key without storing the secret). Plus the protocol
version string. The key changes when any input that affects `tools/list` changes; it does not change
when unrelated config changes.

**3. TTL and refresh.** Default TTL 24 h. Within TTL, the cache is used without contacting the
server. Past TTL, the client re-runs `tools/list` and overwrites the cache; a failure to refresh
fails the run (fail-closed), it does not silently fall back to stale data. A `--refresh-mcp-cache`
flag (or env `AGENTHOOD_MCP_CACHE_REFRESH=1`) forces revalidation regardless of TTL.

**4. Corrupt or stale cache.** A file that fails to parse, has a mismatched key, or has an unknown
shape is deleted and treated as a miss. A cache hit whose tool list no longer matches the server
(determined only at call time) fails closed on the call: the tool is not silently invoked.

**5. Scope.** Cache covers both stdio and http transports (ADR-048). The cache is per host working
directory, not per member, because `tools/list` is a property of the server, not the member.

**6. What is never cached.** Tool call results, arguments, and secrets. Only `McpToolInfo[]`.

## Alternatives Considered

| Option | Pros | Cons | Why Rejected |
|---|---|---|---|
| Cache in memory only | No disk, no staleness | Lost on every run; no benefit | Rejected: defeats the purpose |
| Cache keyed on server name only | Simple | Stale across config changes | Rejected: unsafe |
| Never fail on stale cache | Resilient | Hides server changes | Rejected: fail-closed |
| Cache call results too | Faster | Results may be secrets; staleness risk | Rejected: out of scope |

## Consequences

- Second and later runs skip `tools/list` when the cache is valid, reducing latency and one failure
  point.
- A server that changes its tool list is picked up within TTL only via forced refresh; hosts that
  deploy new server versions should force refresh or wait for TTL.
- Cache files contain tool schemas only; no secrets. The key includes a hash of secret values, not
  the values.

## References

- [ADR-047](ADR-047-mcp-client-scope.md): scope, fail-closed.
- [ADR-048](ADR-048-http-transport.md): transports.
- [ADR-049](ADR-049-remote-auth-via-env-headers.md): secret handling.
