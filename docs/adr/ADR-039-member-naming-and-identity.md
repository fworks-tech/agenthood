# ADR-039: Member Naming and Identity

**Date:** 2026-11-16
**Status:** Superseded by ADR-044

## Context

A member is referenced by its name in five places that must agree: the directory, the frontmatter
`name`, the `activate_skill` argument, the chain step, and the registry key. Names that drift across
those places produce silent misses: the skill exists, the run does not find it.

Two naming styles were available. Descriptive names (`commit-message-writer`, `test-generator`) say
what the member does. Role names (`scribe`, `tester`) say what the member *is*. The Society already
uses roles in its own vocabulary (`AGENTS.md`, chains, prompts), and a role name survives a change of
scope: a Scribe that stops writing changelogs is still a Scribe, while `commit-message-writer` would
have to be renamed.

## Decision

1. **One word, noun form, formal register, doubling as a job title.** `Scribe`, `Warden`, `Herald`.
   Reject corporate register (`Coordinator`), generic terms (`Helper`), and names that collide with
   an existing member (`Reporter` ≈ `Herald`).
2. **The directory carries the `the-` prefix; the identity does not.** On disk a first-party member is
   `skills/the-scribe/SKILL.md`, and the frontmatter `name` is `the-scribe`: matching the directory
   exactly, because discovery uses the name as the key and the Sentinel rejects a mismatch.
3. **The role name is the singular word without the prefix** (`scribe`). Chains, `AGENTS.md` and prose
   use the role; the file uses `the-<role>`.
4. **The registry key is a namespace plus that name**: `fworks-tech/the-scribe` for official members,
   `<author>/the-<name>` for contrib (ADR-035). A leading `@` is command-line input only and is never
   stored.
5. **No second identity.** A member has one `SKILL.md`. A duplicate under `docs/members/` is rejected
   by the Sentinel; `verify --dedup` reports the same name in two search roots.

## Consequences

- Adding a member is a directory and a file, not a registry row.
- A rename is a breaking change: the directory, the frontmatter, every chain step, every doc link and
  the lockfile entry move together. That cost is why the name is chosen for the role, not the task.
- Skill names outside the Society's vocabulary follow the same rules for the flat identity but do not
  need a role: `web-research`, `aws`, `postgres` are skills, not members, and keep their descriptive
  names.

## References

- [The Oracle](../../skills/oracle/SKILL.md): the naming rules applied when authoring
- [ADR-028](ADR-028-skill-frontmatter-contract.md): the frontmatter the name lives in
- [ADR-035](ADR-035-skill-namespaces-and-well-known-catalogs.md): namespaces and the `owner/name` key
