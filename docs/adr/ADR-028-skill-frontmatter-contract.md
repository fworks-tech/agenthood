# ADR-028: SKILL.md Frontmatter as an Enforced Contract

**Date:** 2026-09-21
**Status:** Accepted

## Context

`SKILL.md` files are simultaneously prompts, distribution artifacts, and trust
boundaries. Agentskills.io defines an `allowed-tools` declaration to pre-approve a
skill's tool surface, but the runtime ignored it: declarations were decorative, and a
skill saying `allowed-tools: Read` could still get Bash-class tools. Description text
also doubles as the router's selection signal — vague descriptions misroute members.

## Decision

Frontmatter is a contract with two enforced parts:

1. **`allowed-tools`** — parsed by `MemberRegistry` from each member's SKILL.md.
   Effective tools = declared ∩ permission-profile, so a declaration can only **narrow**,
   never expand. Absent declaration keeps the profile default. `MemberAgent` fails closed:
   any tool not classified read-only/write/trusted is denied for every profile, so a new
   state-touching tool cannot leak before it is categorized.
2. **Trigger phrases** — `description` must open with what the member does and state when
   to use it ("Use when/before …"). This is convention-enforced (`verify` validates the
   agentskills.io shape; The Sentinel audits description quality) rather than runtime-error.

All 20 members declare `allowed-tools`; the legacy descriptive-name aliases
(`code-review`, `test-driven-development`, …) were collapsed to deprecated stubs pointing
at their canonical `the-*` files to remove duplicate sources of truth.

## Alternatives Considered

| Option | Pros | Cons | Why Rejected |
|--------|------|------|-------------|
| Profile-only (no frontmatter) | already safe | trust boundary lives in code, ships wrong for third-party skills | Rejected |
| Declared tools override profile | maximal per-skill control | a SKILL.md edit could silently grant `pr_sync` to a restricted member | Rejected |
| Delete legacy aliases outright | cleanest | external installs may reference those paths | Rejected in favor of stubs |

## Consequences

Easier: per-skill least-privilege is now data a reviewer can read; enforcement is one
intersection function. Harder: adding a tool means touching member-specs, frontmatter,
and classification sets together (verify gates catch drift via agenthood.lock hashes).

## References

- `src/members/MemberRegistry.ts` (`intersectDeclaredTools`), `src/members/MemberAgent.ts`
- Issue #641/#648, PRs #902/#904; ADR-020 (integrity gate), ADR-025 (loop it guards)
