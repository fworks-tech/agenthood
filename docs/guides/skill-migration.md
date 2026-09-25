# Guide: Migrating Skills from Copilot, CLAUDE.md, and Cursor

> Your instructions already exist somewhere else. This guide moves them into a
> `SKILL.md` the Society can verify — without rewriting them by hand.

## Overview

Three common sources map onto the same target: YAML frontmatter (`name`,
`description`) plus a prompt body. The body migrates verbatim; only the
frontmatter is new.

| Source | File | What becomes the body |
|--------|------|----------------------|
| Copilot custom instructions | `.github/copilot-instructions.md` or `*.instructions.md` | `applyTo` globs become a `Use when …` trigger in `description` |
| `CLAUDE.md` | `CLAUDE.md` / `AGENTS.md` at repo root | Whole file, split per section if it covers unrelated tasks |
| Cursor rules | `.cursor/rules/*.mdc` | `description` + `globs` frontmatter fold into `description`; body after the frontmatter |

## Automated conversion

```bash
node scripts/migrate-skill.mjs .github/copilot-instructions.md code-reviewer ./skills/code-reviewer
node scripts/migrate-skill.mjs CLAUDE.md repo-guide ./skills/repo-guide
node scripts/migrate-skill.mjs .cursor/rules/testing.mdc
```

The script slugifies the name to the spec (`lowercase-hyphen`), derives
`description` from the first substantive line, and appends a `Use when …`
trigger when none is present. Review the generated `SKILL.md` — the script
guesses the trigger, you confirm it.

## Manual steps

1. Pick a name matching the target directory (`skills/<name>/SKILL.md`).
2. Write `description` as what **plus** when: `… . Use when …`.
3. Declare the minimum `allowed-tools` (`file.read file.search` before `file.write`).
4. Paste the source as the body; delete tool-specific syntax (`applyTo`, `globs`, `@file` references).
5. Split sources covering unrelated tasks into one skill per task.

## Validation after migration

```bash
npx agenthood verify   # frontmatter shape + name↔directory match
```

`verify` fails on mismatched names, missing descriptions, and undeclared tool
widening. Fix what it flags, then copy into your provider path (`.agents/skills/`,
`.claude/skills/`) as in the [quickstart](../academy/quickstart.md).

## Further reading

- [Authoring a Skill](../academy/level-3-advanced-skills/06-author-a-skill.md) — contract details and ship checklist
- [`src/skills/discovery/SkillParser.ts`](../../src/skills/discovery/SkillParser.ts) — what `verify` enforces
