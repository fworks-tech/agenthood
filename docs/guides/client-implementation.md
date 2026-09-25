# Guide: Implementing Skill Support in a New Client

> Five steps turn a directory of Markdown files into skills a model can
> actually use: discover, parse, disclose, activate, manage context.

## Overview

The runtime's pipeline lives in `src/skills/` with trust boundaries in
`src/agents/memberLore.ts` and budgeting in `src/core/ContextCompressor.ts`.
Implement the same five stages in order; each stage has one edge case that
breaks interop if ignored.

## The 5 steps

### 1. Discover

Scan scopes with project-over-user precedence: project `.agents/skills/`,
user `~/.agents/skills/`, plus `.claude/skills/` and the bundled `skills/`
directory.

```typescript
// mirrors src/skills/discovery/SkillDiscovery.ts
const scopes = ['<project>/.agents/skills', '~/.agents/skills', '<project>/.claude/skills']
```

Edge case: match `SKILL.md` case-insensitively (`skill.md` from other clients)
and fall back to a lenient YAML parse for malformed frontmatter — strict-only
parsers silently drop third-party skills.

### 2. Parse

Split YAML frontmatter from body, enforce the contract: `name` matches the
directory (`lowercase-hyphen`), `description` states what **and** when.

```typescript
// mirrors src/skills/discovery/SkillParser.ts
const match = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/)
```

Edge case: keep `parse()` permissive and enforce the spec in a separate
`verify` gate — skills that fail strict parsing should warn, not vanish.

### 3. Disclose

Send the model names + descriptions (the catalog), never full bodies. Use
3-tier progressive disclosure: catalog first, full body only for the activated
skill.

Edge case: wrap activated content in explicit trust-boundary tags (see
`src/agents/memberLore.ts`) so tool output can't impersonate instructions.

### 4. Activate

Resolve one skill per trigger: exact slash-command match first, model-driven
selection from the catalog second, deterministic name-collision rule with a
warning when two scopes provide the same name.

```typescript
// mirrors src/skills/activation/ActivateSkillTool.ts
```

Edge case: permission narrowing — declared `allowed-tools` may only narrow the
skill's tool surface below its profile, never widen it.

### 5. Manage context

Track token spend per skill and compress or defer when the budget overflows
(see `src/core/ContextCompressor.ts` and `src/core/TokenCounter.ts`).

Edge case: protect activated skill content from context compaction — pruning
the active skill mid-run produces wrong output with no error.

## Validation

```bash
npx agenthood verify   # contract gate for anything you emit
npx agenthood doctor   # discovery scopes, lockfile integrity
```

## Troubleshooting

- Skill missing: check scope precedence and filename case first.
- Model ignores skill: `description` lacks a `Use when …` trigger.
- Privilege surprise: audit `allowed-tools` against the profile default.
- Full troubleshooting: [troubleshooting](troubleshooting.md).

## Further reading

- [Agent Skills specification](https://agentskills.io/specification) — upstream format
- [`src/skills/discovery/SkillDiscovery.ts`](../../src/skills/discovery/SkillDiscovery.ts) — discovery source
- [`src/skills/discovery/SkillParser.ts`](../../src/skills/discovery/SkillParser.ts) — parsing source
