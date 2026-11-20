# Spec: MCP Client Follow-ups

**Status:** In progress
**Issue:** #1072 (follow-ups; original issue closed by PR #1144)
**Tracking issues:** #1157 (Phase 0), #1158, #1159, #1160 (Phase 1), #1161, #1162, #1163, #1164, #1165 (Phase 2)

---

## Problem

The MCP client shipped in PR #1144 (ADR-047) covers the stdio happy path and the core intersection
rule, but leaves three classes of gap:

1. **Unverified behavior.** Four behaviors are claimed but not exercised by tests: the child process
   receives only the inherited environment (not a parent secret), a tool result with `isError: true`
   is returned to the model as a tool error, a `SKILL.md` that declares `mcpServers` starts no
   server end to end, and the SIGINT/SIGTERM hook takes a child down (verified only as "child dies
   with host", not as hook delivery).
2. **Missing capabilities.** ADR-047 explicitly leaves out: per-server environment, a per-server
   `readOnly` flag, HTTP/URL transport, remote server auth, and tool-list caching. Without these, a
   host cannot run a server that needs an API key, cannot expose read-only tools to `restricted`
   members, cannot reach a remote server, and re-lists tools on every run.
3. **Undocumented decisions.** The above capabilities need their own ADRs before any `src/` change,
   per the repo convention; otherwise the design drifts into code.

## Proposed Solution

Two phases.

**Phase 1: verification (3 PRs).** Close the four unverified behaviors with targeted tests and one
small refactor (`MemberRegistry` constructor accepts a members directory, so the no-spawn assertion
can be exercised without touching `skills/`). No behavior change.

**Phase 2: capabilities (5 PRs, ordered).** Each capability is one ADR plus one implementation PR,
in dependency order: env (ADR-052) → HTTP (ADR-048) → auth (ADR-049) and cache (ADR-050); readOnly
(ADR-051) is independent. HTTP reuses the env-substitution rule from ADR-052 so auth needs no new
config block. Cache covers both transports.

## Out of Scope

- Hosted deployments / remote server hosting (the agenthood server side is unchanged).
- Changes to `agenthood.lock` (no member declares MCP tools).
- Windows delivery of SIGINT/SIGTERM to a child (platform limitation; documented, not tested).
- A new `auth` config block (replaced by env-substituted headers).
- Revisiting ADR-047's decisions; ADR-051 amends it via "Amends", ADR-047 stays Accepted.

## Acceptance Criteria

- [ ] `docs/specs/mcp-client-follow-ups.md` and `-tasks.md` exist and are reviewed.
- [ ] ADRs 048-052 exist, are Accepted, and are indexed in `docs/adr/README.md`.
- [ ] Phase 1: child env test asserts the parent secret is absent; `isError:true` test asserts `{success:false}` plus `failed` audit; no-spawn E2E test asserts zero `McpStdioClient.start` calls; POSIX signal test passes on Linux/macOS and is skipped with reason on Windows.
- [ ] Phase 2 env: a server `env` reaches the child; a missing `${env:VAR}` fails before spawn; a literal secret-like value fails config load; no value appears in decisions/provenance.
- [ ] Phase 2 readOnly: a `restricted` member receives a tool from a `readOnly` server and is denied a tool from a non-readOnly server; `standard`/`trusted` unchanged.
- [ ] Phase 2 HTTP: a Streamable HTTP server passes initialize/list/call; connection loss or timeout fails the run; all existing stdio tests pass unchanged.
- [ ] Phase 2 auth: a bearer header is sent; missing env fails before connect; token absent from decisions/provenance.
- [ ] Phase 2 cache: second run avoids `tools/list`; expired cache revalidates; corrupt cache ignored; a removed tool fails closed on call.
- [ ] Every PR passes `npm test`, `lint`, `typecheck`, `build`, `lint:prose`, `lint:links`, `decision-gate.test.sh`, `filesize-check.sh`, `npx agenthood verify`.

## Testing Strategy

- Unit: `tests/unit/mcp/*`, `tests/unit/members/MemberRegistry.test.ts`, `tests/unit/commands/loadConfig.test.ts`.
- Integration: `tests/integration/mcp-member-run.test.ts` extended where a behavior crosses the run boundary.
- Fixtures: `tests/fixtures/mcp-fixture-server.mjs` gains `error-on-call` mode and an `envkeys` tool; new `tests/fixtures/mcp-signal-host.ts`.
- POSIX-only: `it.skipIf(process.platform === 'win32')` with an explicit reason.

## Open Questions

- Cache TTL default: 24 h, configurable per server? Deferred to ADR-050.
- Whether `env` literal values are allowed for non-sensitive keys only, or never: resolved to "non-sensitive only" (see ADR-052).
- Whether `readOnly` defaults to false: yes (host must opt in).
