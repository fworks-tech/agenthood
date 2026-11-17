# ADR-044: Member Naming Uses the Shipped Unprefixed Layout

**Date:** 2026-11-17
**Status:** Accepted
**Supersedes:** ADR-039 (Member Naming and Identity)

## Context

ADR-039 decided that a first-party member lives at `skills/the-<role>/SKILL.md`
with frontmatter `name: the-<role>`, so the directory and the identity matched
exactly. The repository that shipped does not use that layout. Every member
lives at `skills/<role>/SKILL.md` with `name: <role>`, and no `skills/the-*/`
directory exists.

`src/members/MemberRegistry.ts` keeps an `ALIASES` table that maps `the-scribe`
to `scribe`, `the-architect` to `architect`, and so on for every built-in role.
The table is labelled backward compatibility and `canonicalName()` resolves
aliases before lookup. The runtime therefore treats `the-*` as a legacy input
spelling, not as the member identity. Chains, prose and the documented member
list already use the unprefixed name.

This is a record of what was delivered, not a rename. Changing directory names
or frontmatter would break discovery for every existing member and would touch
more than the documentation.

## Decision

The shipped layout is authoritative. A member is the directory
`skills/<role>/SKILL.md` with frontmatter `name: <role>`. The `the-*` spelling
is accepted only as a legacy alias through `MemberRegistry`, and new documents,
chains and examples use the unprefixed role.

ADR-039 remains in force for its other decisions: one word noun in the formal
register, the role name without a prefix for prose and chains, a namespaced
registry key, and a single `SKILL.md` per member. Only the prefixed directory
and prefixed `name` from ADR-039 are superseded. ADR-039 is kept in the record
and marked superseded by this ADR.

## Alternatives Considered

| Option | Pros | Cons | Why Rejected |
|--------|------|------|-------------|
| Rename every directory and `name` to `the-<role>` (ADR-039 path) | Matches the earlier decision literally | Breaks discovery, lockfile entries, aliases and every existing link; large mechanical change | The runtime already resolves the alias, so the rename buys no capability |
| Keep two identities, prefixed on disk and unprefixed in prose | Preserves both spellings | Two names for one member is the drift ADR-039 set out to prevent | Reintroduces the silent misses the rule was written for |
| Record the shipped unprefixed layout and keep aliases for input (chosen) | One identity, legacy input still works, no migration cost | The earlier ADR text no longer describes the directory layout | The code and the shipped files agree, and the difference is now documented |

## Consequences

- Documentation examples use `skills/<role>/SKILL.md` and `name: <role>`.
- A user typing a `the-*` name still resolves through `MemberRegistry`, so no
  existing invocation breaks.
- ADR-039 stays readable as history with its status set to superseded. Its
  numbering is unchanged, as is the gap left by ADR-006 and ADR-007.

## References

- [ADR-039](ADR-039-member-naming-and-identity.md): the decision this ADR supersedes
- [ADR-028](ADR-028-skill-frontmatter-contract.md): the frontmatter that carries `name`
- [ADR-035](ADR-035-skill-namespaces-and-well-known-catalogs.md): namespaced registry keys
- [`MemberRegistry`](../../src/members/MemberRegistry.ts): the alias table and canonical name resolution
