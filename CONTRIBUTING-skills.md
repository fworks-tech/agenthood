# Contributing Skills to Agenthood

This guide covers how to author, test, and submit skills for the Agenthood Society.

## Skill File Structure

Every skill lives in `skills/<name>/SKILL.md`. The directory name must match the `name` field in frontmatter.

```
skills/
└── the-example/
    └── SKILL.md
```

## SKILL.md Format

```markdown
---
name: the-example
description: One-line description of what this skill does and when to trigger it.
license: MIT
---

# The Example

## Overview
[2-4 sentences on philosophy and approach]

## When to Use
- [Trigger scenario 1]
- [Trigger scenario 2]

## Process

### [Primary Process]
1. [Step]
2. [Step]

## Red Flags
- [Anti-pattern to avoid]

## Rationalizations

| What you think | What The Example knows |
|----------------|----------------------|
| "[Objection]" | [Rebuttal] |

## Verification

Before confirming the task is done:

- [ ] [Checkpoint 1]
- [ ] [Checkpoint 2]
```

## Frontmatter Rules

| Field | Required | Rules |
|-------|----------|-------|
| `name` | Yes | Lowercase, hyphen-separated, matches directory name, ≤64 chars |
| `description` | Yes | One sentence. Third person ("Use when...", not "I help with..."). Front-load trigger keywords. |
| `license` | No | SPDX identifier (default: MIT) |

**Description quality checklist:**
- Covers both *what* the skill does AND *when* to use it
- Starts with a verb or "Use when..."
- Contains concrete trigger keywords (filenames, commands, error messages)
- Gates with "Use ONLY when..." if the skill should stay quiet on adjacent topics

## Naming Conventions

- One word, noun form, archaic or formal register
- Must double as a job title ("The Scribe", not "The Commit Writer")
- Must not overlap with existing members (see `AGENTS.md` for the full list)
- Must read naturally as "The [Name]"

**Accepted:** Steward, Chancellor, Cartographer, Warden, Sentinel, Custodian
**Rejected:** Manager (corporate), Validator (jargon), Helper (generic)

## Required Sections

Every SKILL.md must include these six sections (enforced by The Sentinel):

1. **Overview** — philosophy and approach (2-4 sentences)
2. **When to Use** — trigger scenarios as bullet list
3. **Process** — step-by-step instructions with named sub-processes
4. **Red Flags** — anti-patterns and things to avoid
5. **Rationalizations** — table of common objections and rebuttals
6. **Verification** — checklist of checkpoints before confirming done

## Quality Standards

- **No comments in code examples** — explain why, not what
- **Single quotes, no semicolons** — matches repo convention
- **Examples must be runnable** — copy-paste should work
- **File discipline** — keep SKILL.md under 300 lines
- **No dead references** — every linked file must exist

## Testing Your Skill

1. Load the skill into an agent runtime:
   ```bash
   agenthood run the-example "do something specific"
   ```
2. Verify the agent follows the Process steps
3. Verify the agent respects the Red Flags
4. Run the repo's test suite to check for structural issues:
   ```bash
   npm test
   ```

## Submission Process

1. Create a branch: `feat/issue-NUMBER-add-the-example`
2. Add `skills/the-example/SKILL.md`
3. Update registration files (see The Oracle's checklist in `AGENTS.md`)
4. Run `npm test` to verify structural integrity
5. Open a PR with The Scribe's format (What/Why/How-to-test)
6. The Sentinel will validate structure, The Warden will check quality

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Description starts with "I help with..." | Rewrite as "Use when..." |
| Missing Rationalizations table | Add table with 2+ common objections |
| SKILL.md over 300 lines | Split into sub-processes or extract examples |
| Directory name doesn't match `name` field | Rename directory to match |
| No verification checklist | Add 3+ checkpoints |
