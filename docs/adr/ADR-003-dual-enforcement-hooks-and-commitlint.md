# ADR-003: Dual Enforcement via Bash Hooks and Commitlint

**Date:** 2026-06-02
**Status:** Accepted

## Context

Commit message enforcement could be achieved by commitlint alone (via Husky
and `@commitlint/cli`), or by a custom bash hook alone. The question was
whether both were necessary.

The Society needed enforcement that:
- Works in the agenthood repo itself (no Node.js dependency at hook time)
- Works in target projects that adopt the Society (Node.js available)
- Provides actionable feedback, not just pass/fail
- Catches vague subjects that commitlint's rules cannot express

## Decision

The Society uses both layers:

1. **Bash hook** (`.githooks/commit-msg`): runs in the agenthood repo itself,
   validates type, subject, length, and vague-subject rules without Node.js.
2. **Commitlint** (`.husky/commit-msg` in target projects): runs via
   `@commitlint/config-conventional` for schema validation and integrates
   with the Node.js ecosystem that target projects already use.

## Alternatives Considered

| Option | Pros | Cons | Why Rejected |
|--------|------|------|-------------|
| Commitlint only | Single source of truth; rich plugin ecosystem | Requires Node.js at hook time; agenthood repo itself cannot use it during development without extra setup | Creates a bootstrapping dependency |
| Bash hook only | Zero dependencies; portable | No plugin ecosystem; rules must be hand-coded; harder to maintain | More maintenance burden for no gain in target projects |
| Dual enforcement (chosen) | Each layer covers what the other cannot; agenthood is self-enforcing from day one | Two rule sets must stay in sync (The Doorman's job) | — |

## Consequences

**Easier:** The agenthood repo enforces its own standards without depending
on its own npm package being installed. Target projects get familiar Husky
integration.

**Harder:** Rules must be kept in sync between `.githooks/commit-msg` and
`commitlint.config.cjs`. Drift between the two was the cause of issue #8
(now fixed).

**New risk:** A rule present in the bash hook but absent from commitlint
(or vice versa) will produce inconsistent behaviour across environments.
The Sentinel CI workflow guards against this.

## References

- [.githooks/commit-msg](https://github.com/fworks-tech/agenthood/blob/main/.githooks/commit-msg) — bash enforcement hook
- [conventions/commitlint.config.cjs](https://github.com/fworks-tech/agenthood/blob/main/conventions/commitlint.config.cjs) — Node.js enforcement config
- [.github/workflows/sentinel.yml](https://github.com/fworks-tech/agenthood/blob/main/.github/workflows/sentinel.yml) — drift detection
- [ADR-002](ADR-002-conventional-commits-standard.md) — why Conventional Commits
