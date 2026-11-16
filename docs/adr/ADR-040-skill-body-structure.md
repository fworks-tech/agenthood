# ADR-040: SKILL.md Body Structure

**Date:** 2026-11-16
**Status:** Accepted

## Context

A `SKILL.md` body is an instruction document a model follows with no editor and no ability to ask
questions. Free-form prose gives the model no way to tell a definition from a step, a preference from
a hard rule, or an excuse from a prohibition. Every member written from scratch invents its own
layout, and the ones that work share a shape the others do not.

Two costs follow from an unstructured body. A body that mixes "what this is" into the middle of the
process gets truncated first when the budget bites, and a body with no stop conditions lets the model
rationalise past the rule it was given.

## Decision

A member body has six sections, in this order. The Sentinel checks for them.

| Section | Content | Why it exists |
|---------|---------|---------------|
| `## Overview` | What the member is, the failure it prevents | The model needs the goal before the steps |
| `## When to Use` | Concrete triggers, and what it is *not* for | Routing and false-positive prevention |
| `## Process` | Ordered, imperative, verifiable steps | The work itself |
| `## Red Flags` | What to stop and report | Stop conditions, not preferences |
| `## Rationalizations` | Excuse → counter, usually a table | The shortcut the model would take |
| `## Verification` | How to check the work before claiming done | The definition of finished |

Rules that follow from the shape:

1. **The body is instructions, not documentation.** No changelog, no history, no author biography.
   Background that a step needs is one line inside that step.
2. **Progressive disclosure.** A body stays under about 5000 tokens (`verify --tokens`); long material
   moves to `references/` and the body says when to read it. The body is paid for again on every
   activation.
3. **Relative paths only.** Files a body points at resolve from the skill directory, never the project
   root, and never escape it (`findMissingReferences`, ADR-036).
4. **Cross-skill calls are by name.** A skill that needs another calls `activate_skill`; it never
   copies the other body in (ADR-038). One-shot instructions opt out of replay with
   `compaction-replay: false`.
5. **The six sections are prose, the frontmatter is the contract.** Tools, model targets, requirements
   and variants belong in frontmatter where they are parsed and gated (ADR-028, ADR-037), never in prose.

## Alternatives Considered

| Option | Pros | Cons | Why Rejected |
|--------|------|------|--------------|
| Free-form body | maximum author freedom | no way to verify completeness, drift between members | Rejected: the Sentinel audit needs a shape |
| A rigid template with required bullet counts | mechanical checking | produces filler; the worst members are the ones filling slots | Rejected |
| XML-tagged sections | machine-parseable | unreadable for humans reviewing the diff | Rejected: `SKILL.md` is reviewed as prose |

## Consequences

- A new member starts from the Oracle template, not from a blank file.
- A missing section is a review finding, not a runtime error: the body is instructions, and the
  runtime has no schema for prose.
- The rationale for the shape lives here, so a reviewer can say "this is an ADR-040 problem" instead of
  arguing style.

## References

- [The Oracle](../../skills/oracle/SKILL.md) — the template and the section contract
- [ADR-028](ADR-028-skill-frontmatter-contract.md) — the frontmatter half of the contract
- [ADR-038](ADR-038-skill-discovery-and-execution-caching.md) — compaction protection and replay
- `CONTRIBUTING-skills.md` — the authoring checklist
