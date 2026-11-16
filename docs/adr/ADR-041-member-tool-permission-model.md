# ADR-041: Member Tool Permission Model

**Date:** 2026-11-16
**Status:** Accepted

## Context

A member runs with a prompt someone else wrote. If that prompt can reach any tool the runtime has, a
misleading skill is a privilege escalation: it can push branches, open PRs, or write files the
reviewer never approved. `allowed-tools` narrows a skill's declared surface (ADR-028), but the
declaration alone is not enough: an omitted declaration must not mean "everything", and a new tool
must not be granted by default.

Three profiles existed (`restricted`, `standard`, `trusted`) whose difference was implicit in code.

## Decision

**A member's effective tools are the intersection of its `allowed-tools` declaration and its profile
grant.** Both sides must allow a tool; either side can only narrow.

The profiles are cumulative:

| Profile | Read-only tools | Write tools | Trusted tools | Delegation |
|---------|-----------------|-------------|---------------|------------|
| `restricted` | yes | no | no | no |
| `standard` | yes | yes | no | read-only roles only |
| `trusted` | yes | yes | yes | read-only roles only |

Classification is a fixed allowlist in `MemberAgent`:

- READ-ONLY: `ask_human`, `file.read`, `file.search`, `code.explain`, `generate_image`,
  `speech_to_text`, `generate_video`
- WRITE: `file.write`, `code.write`, `code.refactor`, `text_to_speech` (it writes a file)
- TRUSTED: `pr_sync`

**Anything not classified is denied for every profile.** That is the load-bearing rule: a new tool is
unusable until someone classifies it, so a tool cannot leak into a restricted member by being added to
the vocabulary. `ask_human` is read-only by definition; it asks, it does not mutate.

`delegate_task` is separate: opt-in per member spec (`canDelegate`), and limited to the read-only
analysis roles in `DELEGATION_ALLOWED_ROLES`. A write-capable agent is never a delegation target.

## Alternatives Considered

| Option | Pros | Cons | Why Rejected |
|--------|------|------|--------------|
| Profile only | one place to reason | a third-party skill could not narrow further than its profile | Rejected: least privilege is per skill |
| Declaration overrides profile | maximal skill control | a SKILL.md edit could grant `pr_sync` to a restricted member | Rejected |
| Deny-by-default with explicit grants per member | tightest | every member carries a full tool list that drifts from the vocabulary | Rejected: one classification table is easier to audit |
| Default-allow for unknown tools | never blocks a new tool | silently widens every member when a tool is added | Rejected: the failure is invisible |

## Consequences

- Adding a state-touching tool requires classifying it, and the classification is a reviewable line in
  the diff.
- A third-party member starts read-only: its profile is chosen by the reviewer, not by its author.
- The enforcement point is the reasoning loop, before the tool executes: a denied call is a tool
  error the model sees and can recover from, not a crash.
- Hosts that build an `ExecutionContext` by hand must wire the skill-scope hook; omitting it skips
  enforcement (ADR-032).

## References

- `src/members/MemberAgent.ts` (classification and `isAllowed`), `src/members/member-specs.ts`
- [ADR-028](ADR-028-skill-frontmatter-contract.md): `allowed-tools` parsing and the intersection
- [ADR-032](ADR-032-skill-tool-enforcement.md): call-time enforcement in `ReActLoop`
- [ADR-020](ADR-020-mind-virus-mitigation.md): why delegated content is untrusted
