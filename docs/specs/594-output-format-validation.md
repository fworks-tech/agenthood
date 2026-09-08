# Spec: Skill Output Format Validation (#594)

## Problem
Skills produce free-form string output (`AgenthoodResult.output`). Nothing validates that output matches an expected structure. Downstream tools (CI, linters, parsers) depend on consistent output format, but a member can silently emit arbitrarily malformed text.

## Proposed Solution
Add an optional `output_format` field to SKILL.md frontmatter — a regex pattern the output must match. After a member run, validate the output against it. A second field, `output_format_mode`, controls whether a deviation fails the run (`strict`) or warns (`lenient`, default).

Runtime validation in `MemberRunner` (where output is produced), so every `agenthood run` enforces format — not just eval runs.

## Out of Scope
- JSON Schema validation of structured output (regex covers the stated need; can extend later — see Open Questions)
- Template-based validation
- Frontmatter changes to third-party skills (`SkillParser` path untouched)
- Breaking existing runs (default mode is `lenient`)

## Acceptance Criteria
- [ ] `output_format` field parsed from member SKILL.md frontmatter into `MemberSpec`
- [ ] Output validated against the pattern after each member run
- [ ] Error message includes the expected pattern and the (truncated) actual output
- [ ] `strict` mode records a format deviation as a run failure; `lenient` mode warns only

## Design

### Frontmatter (member SKILL.md)
```yaml
---
name: the-architect
description: ...
output_format: ^(## .+\n)+.*   # regex the full output must match
output_format_mode: strict       # strict | lenient (default: lenient)
---
```

### Types (`src/members/types.ts`)
Add `output_format?: string` and `output_format_mode?: 'strict' | 'lenient'` to `MemberFrontMatter` and `MemberSpec`.

### Parsing (`src/members/MemberRegistry.ts`)
Member frontmatter is currently only stripped (`stripFrontmatter`), not parsed. Parse the frontmatter block (reuse the `---` delimiter regex already in `memberLore.ts`) and extract `output_format` / `output_format_mode` into the built `MemberSpec`. Falls back gracefully when absent.

### Validation (`src/runtime/MemberRunner.ts`)
After `agent.run()` produces `result`, if `spec.output_format` is set, test `result.output` against the regex:
- **match** — no action.
- **deviation + strict** — record a failure (`metricsCollector.record(name, false, …)`, emit `run.failed` with a format-deviation message), rethrow as `OutputFormatError`.
- **deviation + lenient** — `console.warn` an actionable message; run still succeeds.

A small pure helper `validateOutputFormat(output, pattern, mode)` holds the regex test + message formatting so it is unit-testable in isolation.

### Error message
`output_format deviation (strict): expected output matching /<pattern>/, got: "<output truncated to 200 chars>"`

## Testing Strategy
- **Unit**: `validateOutputFormat` — match passes; mismatch returns expected message; invalid regex handled safely (no throw).
- **Unit**: `MemberRegistry` parses `output_format` / `output_format_mode` from a fixture SKILL.md; absent fields yield `undefined`.
- **Integration**: `MemberRunner` strict mode surfaces a format deviation; lenient mode warns but succeeds. Drive with a mock agent that returns fixed output.

## Open Questions
- **JSON Schema later?** Regex satisfies the current acceptance criteria. If members emit JSON, a future `output_format_type: 'json-schema'` could compile the pattern via the existing `SchemaValidator` (AJV). Defer until a member actually needs it — YAGNI.
- **Global vs per-skill?** Per-skill (frontmatter) is chosen — it is opt-in and co-located with the skill. A global fallback could layer on later without conflict.
