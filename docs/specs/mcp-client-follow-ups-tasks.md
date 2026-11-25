# Tasks: MCP Client Follow-ups

## Phase 0: Design (issue #1157)

- [x] docs(spec): add MCP client follow-ups spec
- [x] docs(spec): add MCP client follow-ups task list
- [x] docs(adr): add ADR-048 HTTP transport
- [x] docs(adr): add ADR-049 remote auth via env-substituted headers
- [x] docs(adr): add ADR-050 tool-list cache for stdio and http
- [x] docs(adr): add ADR-051 readOnly server grants for restricted members (amends ADR-047)
- [x] docs(adr): add ADR-052 per-server environment with secret-reference rule
- [x] docs(adr): index ADRs 048-052 in docs/adr/README.md

## Phase 1: Verification (independent PRs)

### P1a (issue #1158)
- [x] test(mcp): add `error-on-call` fixture mode and `envkeys` tool
- [x] test(mcp): assert child env excludes a parent secret
- [x] test(mcp): assert `isError:true` returns `{success:false}` and audits `failed`

### P1b (issue #1159)
- [x] refactor(members): allow a custom members directory in `MemberRegistry`
- [x] test(members): a SKILL.md `mcpServers` block starts no server and grants no tool

### P1c (issue #1160)
- [x] test(mcp): add `mcp-signal-host.ts` fixture
- [x] test(mcp): assert SIGTERM kills the child on POSIX (skip on Windows with reason)
- [x] docs(runtime): note signal-shutdown verification and Windows limitation

## Phase 2: Capabilities (ordered)

### P2a env (issue #1161)
- [x] docs(adr): ADR-052 (already in Phase 0)
- [x] feat(mcp): add `env` to `McpServerConfig` and `MCP_SERVER_KEYS`
- [x] feat(mcp): resolve `${env:VAR}` and merge env over inherited env
- [x] feat(mcp): fail before spawn on missing env reference or secret-like literal
- [x] test(mcp): env reaches the child; missing ref fails; no value in decisions

### P2b readOnly (issue #1162)
- [x] feat(mcp): add `readOnly` to `McpServerConfig`
- [x] feat(mcp): thread readOnly through `McpSession` to `MemberAgent`
- [x] feat(members): grant readOnly server tools to restricted members
- [x] test(mcp): restricted gets readOnly tool, denied non-readOnly tool

### P2c HTTP (issue #1163)
- [x] feat(mcp): extract `McpTransport` interface from `client.ts`
- [x] feat(mcp): implement `StdioTransport` and `HttpTransport`
- [x] feat(mcp): add `transport`/`url`/`headers` to config and validation
- [x] test(mcp): HTTP server passes initialize/list/call
- [x] test(mcp): connection loss and timeout fail the run

### P2d auth (issue #1164)
- [x] feat(mcp): substitute `${env:VAR}` in HTTP headers
- [x] feat(mcp): fail before connect when a referenced env var is missing
- [x] test(mcp): bearer header sent; token absent from decisions/provenance

### P2e cache (issue #1165)
- [x] feat(mcp): add `McpToolCache` with hash key, TTL, refresh
- [x] feat(mcp): consult cache before `tools/list` in `McpSession`
- [x] test(mcp): second run avoids `tools/list`; expired revalidates; corrupt ignored; removed tool fails closed
