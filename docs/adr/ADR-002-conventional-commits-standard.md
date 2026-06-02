# ADR-002: Conventional Commits as the Commit Standard

**Date:** 2026-06-02
**Status:** Accepted

## Context

The Society needed a commit message standard that could be:

1. Enforced by automated tooling (hooks and CI)
2. Parsed by release automation to determine semantic version bumps
3. Understood by humans without consulting documentation
4. Adopted without inventing proprietary conventions

## Decision

The Society uses the [Conventional Commits](https://www.conventionalcommits.org/)
specification as its commit standard, with a curated set of allowed types:
`feat`, `fix`, `docs`, `test`, `refactor`, `ci`, `chore`.

## Alternatives Considered

| Option | Pros | Cons | Why Rejected |
|--------|------|------|-------------|
| Custom commit format | Total control over rules | No ecosystem tooling; every adopter must learn a new format | Reinventing a solved problem |
| Conventional Commits (chosen) | Industry standard; semantic-release integration; commitlint support; human-readable | Slightly verbose; requires type discipline | — |
| No standard | Zero friction | Commit history becomes archaeology | Incompatible with the Society's purpose |
| Emoji-based commits (gitmoji) | Visually distinct | Not machine-parseable; no tooling for semver bumping | Not suitable for automated release |

## Consequences

**Easier:** `semantic-release` can determine version bumps from commit history
automatically. The Scribe and The Herald can generate changelogs without
manual curation.

**Harder:** Contributors must learn the `type(scope): subject` format.
The Doorman enforces this at commit time, which creates friction for new
adopters until the format becomes muscle memory.

**New risk:** Scope can be omitted, which reduces the signal value of the
commit history. The Doorman enforces subject rules but does not require scopes.

## References

- [conventions/commitlint.config.cjs](../../conventions/commitlint.config.cjs) — enforcement rules
- [conventions/COMMIT_CONVENTION.md](../../conventions/COMMIT_CONVENTION.md) — human-readable guide
- [members/the-doorman/the-doorman.md](../../members/the-doorman/the-doorman.md) — enforcement member
- [members/the-scribe/the-scribe.md](../../members/the-scribe/the-scribe.md) — commit message author
