# Skill Creation Quickstart

> *One Markdown file. Five minutes. A skill that runs.*

---

## What it is

A skill is one `SKILL.md` file: YAML frontmatter (the contract) plus a prompt body (the instructions). This guide creates a working skill in under 20 lines.

---

## 1. Create the file (~1 minute)

```bash
mkdir -p skills/code-formatter
```

Write `skills/code-formatter/SKILL.md`:

```markdown
---
name: code-formatter
description: Formats code files to project style. Use when code needs consistent formatting.
allowed-tools: file.read file.write
---

# Code Formatter

Format the file the user points you at to project style.
Preserve behavior. Never invent logic. Ask before reformatting more than one file.
```

That is 10 lines. Three rules: `name` matches the directory (lowercase-hyphen), `description` says what **and** when (`Use when …`), `allowed-tools` declares the minimum.

---

## 2. Verify (~30 seconds)

```bash
npx agenthood verify
```

Expected: the skill parses cleanly. If you typo `name: code-formatters` (directory mismatch), `verify` fails before anything loads — that is the gate doing its job.

---

## 3. Use it (~1 minute)

Copy it into your provider's skill path and invoke it there:

```bash
mkdir -p .agents/skills .claude/skills
cp -r skills/code-formatter .agents/skills/code-formatter
cp -r skills/code-formatter .claude/skills/code-formatter
```

`agenthood run` executes registered members, not arbitrary skill files — so the
command below hands the new skill's *format* to a member that is registered. To
use it as a standalone prompt, invoke it in your provider's skill path instead:

```bash
npx agenthood run the-scribe "format app.ts using the code-formatter rules"
```

---

## Next steps

- [Authoring a Skill](level-3-advanced-skills/06-author-a-skill.md) — frontmatter contract, `allowed-tools` narrow-only rule, ship checklist
- [Getting Started](getting-started.md) — install, first commit, CI
- [Skills Reference](skills-reference.md) — all 20 members, tools, invocation
