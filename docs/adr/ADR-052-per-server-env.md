# ADR-052: Per-Server Environment with Secret-Reference Rule

**Date:** 2026-11-20
**Status:** Accepted
**Supersedes:** None
**Amends:** ADR-047 (section 6, "No `env` key exists in config")

## Context

ADR-047 section 6 forbids an `env` key: the child receives only `PATH` and platform essentials.
Real servers need environment variables (API keys, endpoints, feature flags), so hosts currently
have to wrap the server in a script that sets them, which hides the dependency and breaks the
fail-closed validation. Lifting the ban needs a rule that keeps secrets out of config and out of
the audit trail.

## Decision

**1. `env?: Record<string,string>` per server.** Keys are environment variable names
(`^[A-Za-z0-9_]+$`). Values are either a literal string or a `${env:VAR}` reference resolved
against `process.env` at config load time.

**2. Secret-reference rule.** A key whose name has a whole segment (split on `_` or `-`) in the
sensitive set (`api_key`, `token`, `secret`, `password`, `passwd`, `credential`, `bearer`, `pat`,
`jwt`, `auth`, `authorization`, `cookie`, case-insensitive) MUST use `${env:VAR}`; a literal value
fails config load with an error naming the key and the server, never the value. Whole-segment
matching keeps everyday names usable: `PATH` is not `PAT`, and `AUTHORS` is not `AUTH`. In HTTP
headers (ADR-049), the same rule applies to the header name.

**3. Merge over inherited env.** The resolved `env` is merged on top of the inherited set
(`PATH`, `SystemRoot`, `HOME`, `USERPROFILE`, `TEMP`, `TMP`), so a server entry can override
`PATH` if it needs a different runtime. The child never inherits the full parent environment.

**4. Fail before spawn.** A missing `${env:VAR}` reference, an invalid key name, a non-object
`env`, or a non-string value fails `loadConfig` before any process starts or connection opens,
with an error naming the server and the key/variable.

**5. Redaction.** Resolved values are held in memory only. They never appear in decisions,
provenance, trace output, or logs. Error messages redact any resolved value. The shared redactor
guards the rest.

**6. `${env:VAR}` syntax.** A value may be a single `${env:VAR}` reference, optionally with literal
text around it (e.g. `Bearer ${env:TOKEN}`), resolving to one substitution. Multiple references in
one value are rejected. This keeps parsing unambiguous and auditable while allowing auth headers.

## Alternatives Considered

| Option | Pros | Cons | Why Rejected |
|---|---|---|---|
| Allow full parent env | Simple | Leaks secrets to every server | Rejected: violates the trust boundary |
| `env` only, no references | Simple | Secrets in committed config | Rejected: unsafe |
| Interpolation of multiple vars | Flexible | Parsing ambiguity, injection risk | Rejected: v1 keeps it simple |
| Resolve at spawn time | Fresh values | Harder to fail before spawn | Rejected: fail-closed at load |

## Consequences

- ADR-047 section 6 is amended: `env` now exists, with the secret-reference rule.
- Hosts can run real servers without wrapper scripts.
- Secrets stay in the environment and out of config, decisions and provenance.
- `loadConfig` becomes the single trust boundary for env and auth.

## References

- [ADR-047](ADR-047-mcp-client-scope.md): section 6 (amended).
- [ADR-049](ADR-049-remote-auth-via-env-headers.md): auth via env-substituted headers.
- `src/commands/config.ts` (`parseMcpServers`), `src/mcp/client.ts` (`INHERITED_ENV`, `inheritedEnv`).
