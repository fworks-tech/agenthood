# Authoring a Skill

> *A skill that cannot be parsed is a skill that never runs. The contract is small — learn it once.*

---

## What it is

A skill in Agenthood is one Markdown file: YAML frontmatter on top (the machine-readable
contract) and a prompt body below (the human-readable protocol). Providers read the file
as-is; the runtime additionally parses the frontmatter to decide what the skill is called,
when it should activate, and which tools it is allowed to use.

The frontmatter is the part that gets you blocked at the door. `name` must match the
directory name and follow lowercase-hyphen rules, `description` must say what the skill
does **and when to use it**, and since [PR #904](https://github.com/fworks-tech/agenthood/pull/904) the runtime enforces `allowed-tools`: a
declaration can only narrow the skill's tool surface below its permission profile, never
widen it. A skill that declares nothing keeps its profile's default set — silence is
permissive at the profile level, but it is no longer invisible.

The body is pure prompt. No format is enforced on it, which is exactly why the best bodies
read like onboarding docs for a careful new hire.

---

## Why it matters in production

Skills are loaded by an agent that is trying to pick the right one from the `description`
line alone. Vague descriptions misroute: a skill whose description says "helps with code"
competes with every other skill in the registry, and the provider's choice is a coin flip.
Undeclared or over-broad tool sets are the inverse problem — the skill runs, but with
`file.write` in a review-only workflow, and nobody notices until a bot edits a file it
should never touch. The narrow-only rule means a SKILL.md edit can never escalate
privileges; drift gets caught by `agenthood verify` and the `agenthood.lock` hash gate.

---

## How Agenthood implements it

Parsing and validation live in
[`src/skills/discovery/SkillParser.ts`](../../../src/skills/discovery/SkillParser.ts);
member tool derivation lives in
[`src/members/MemberRegistry.ts`](../../../src/members/MemberRegistry.ts):

```typescript
// MemberRegistry: declared ∩ profile — narrowing only (#641)
static intersectDeclaredTools(declared: string, permission: PermissionProfile): string[] {
  const set = new Set(declared.split(/\s+/).filter(Boolean))
  return MemberRegistry.toolsByProfile[permission].filter((t) => set.has(t))
}
```

Tool vocabulary members may declare: `file.read`, `file.write`, `file.search`, `code.write`,
`code.refactor`, `code.explain`, `pr_sync` (trusted profile only). `ask_human` needs no
declaration — every member can park for human input regardless of frontmatter.

---

## Hands-on example

Create a read-only meeting-notes skill in your project:

```bash
mkdir -p skills/the-notetaker
```

Write `skills/the-notetaker/SKILL.md`:

```markdown
---
name: the-notetaker
# `license` is informational — the runtime parses name/description/allowed-tools;
description: Turns raw meeting transcripts into decisions, owners, and follow-ups. Use when a transcript needs to become action items.
allowed-tools: file.read file.search ask_human
license: MIT
---

# The Notetaker

Read the transcript the user points you at. Extract:
1. Decisions made (verbatim where possible)
2. Owners and deadlines
3. Open questions

Ask the user before guessing an owner. Never invent a date.
```

Validate, then invoke through any member run that has it in scope:

```bash
npx agenthood verify            # frontmatter shape + name↔directory match
npx agenthood run the-scribe "summarize meeting.txt using the-notetaker's format"  
```

`agenthood run` executes registered members, not arbitrary skill files — so the demo
hands the new skill's *format* to a member that is registered. To see it used as a
standalone prompt, copy `skills/the-notetaker/` into your provider's skill path
(`.agents/skills/`, `.claude/skills/`, …) and invoke it there. (`agenthood activate`
covers registered members only.)

Expected: `verify` reports the skill parses cleanly; if you typo `name: the-notetakers`
(mismatched directory), `verify` fails the run before anything loads — that is the gate
doing its job.

---

## Checklist before you ship

- [ ] `name` matches the directory, lowercase-hyphenated
- [ ] `description` says what **and** when ("Use when …")
- [ ] `allowed-tools` declares the minimum — leave the dangerous ones out
- [ ] Body reads like onboarding for a careful new hire
- [ ] `npx agenthood verify` passes; `agenthood.lock` re-locked if a member changed

---

## Share what you ship

**LinkedIn post draft:** *I built an agent skill in one Markdown file — and it had a
trust boundary.* Agenthood's SKILL.md contract: a trigger-phrase description, a narrow-only
`allowed-tools` list, and a `verify` gate that fails the build, not the production.
A skill that cannot be parsed is a skill that never runs.

---

## Further reading

- [ADR-028 — SKILL.md Frontmatter as an Enforced Contract](../../adr/ADR-028-skill-frontmatter-contract.md)
- [`src/skills/discovery/SkillParser.ts`](../../../src/skills/discovery/SkillParser.ts) — validation source
- [Agent Skills specification](https://agentskills.io/specification) — the upstream format `allowed-tools` comes from
