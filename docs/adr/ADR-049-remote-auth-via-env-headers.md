# ADR-049: Remote Server Auth via Env-Substituted Headers

**Date:** 2026-11-20
**Status:** Accepted
**Supersedes:** None
**Amends:** None

## Context

ADR-048 adds HTTP transport with a `headers` slot. A remote server almost always requires a
credential (bearer token, API key). Storing that credential in `.agenthood/config.json` would put a
secret in a file that is committed and logged; storing it in the environment and referencing it by
name keeps the secret out of config, decisions and provenance. ADR-052 already introduces `${env:VAR}`
substitution for per-server env, so auth can reuse the same mechanism instead of a new `auth` block.

## Decision

**1. Auth is headers.** An HTTP server authenticates via `headers`, e.g.
`"Authorization": "Bearer ${env:ATLAS_TOKEN}"`. No `auth` config block exists. This keeps one
substitution rule (ADR-052) and one place to look for credentials.

**2. Only `${env:VAR}` in auth headers.** A header whose name matches the sensitive set
(`authorization`, `x-api-key`, `cookie`, or any name containing `token`, `secret`, `password`,
`credential`, `auth`, `bearer`, `pat`, `jwt`) MUST use `${env:VAR}`; a literal value fails config
load with an error naming the header. Non-sensitive headers may be literal or referenced.

**3. Substitution at load time.** `${env:VAR}` is resolved when `loadConfig` runs, against
`process.env`. A missing variable fails config load before any connection, naming the variable and
the server, never the value. The resolved value is held in memory only; it is never written to
decisions, provenance, trace output, or logs.

**4. Redaction everywhere.** Decisions and provenance record the header *name* only (e.g. "sent header
Authorization"), never the value. Error messages from the transport redact any string matching a
resolved secret. The shared redactor guards the rest.

**5. STDIO.** STDIO servers do not use headers; their credentials come through per-server `env`
(ADR-052). An `env` value for a secret-like key also requires `${env:VAR}`.

## Alternatives Considered

| Option | Pros | Cons | Why Rejected |
|---|---|---|---|
| `auth: { type, tokenEnv }` block | Explicit | Second config concept duplicating headers | Rejected: headers already express it |
| Literal tokens allowed | Simple | Secrets in committed config | Rejected: violates the trust boundary |
| Resolve at request time | Fresh values | Harder to fail before connect; leaks into logs | Rejected: fail-closed at load is clearer |

## Consequences

- One substitution rule (ADR-052) covers env and auth; no second parser.
- A host that rotates a token restarts the process (or re-runs) to pick up the new value; no
  hot reload in v1.
- Redaction becomes a tested invariant, not a convention.

## References

- [ADR-048](ADR-048-http-transport.md): HTTP transport and `headers`.
- [ADR-052](ADR-052-per-server-env.md): `${env:VAR}` substitution and the sensitive-key rule.
- [ADR-047](ADR-047-mcp-client-scope.md): fail-closed and redaction.
