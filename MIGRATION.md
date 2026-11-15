# Migration

## 3.77 → 4.0

4.0 makes members and workflows data. Two changes need action; the rest is additive.

### 1. `Tracer.startSpan` / `endSpan` are gone

The methods were empty and only kept for an interface. If you call them, delete
the calls:

```diff
- context.tracer.startSpan(this.role);
  const result = await this.runStage(...);
- context.tracer.endSpan(this.role, { output });
```

There is no replacement — the trace envelope written by `record()` is the record.

### 2. A skill's `allowed-tools` is enforced

A skill that declares `allowed-tools` now narrows the tools the model may call
while that skill is active. Before 4.0 the field was parsed and ignored.

A tool the skill does not declare is refused, the model sees
`Tool "<name>" is not declared by the active skill (...)` and the run emits a
`tool.denied` event. One-line migration: declare the tool.

```yaml
---
name: my-skill
description: Use when …
allowed-tools: file.read file.search ask_human
---
```

Rules:

- Declared tools are intersected with the member's permission profile — a skill
  can narrow access, never widen it.
- A skill with no `allowed-tools` imposes no restriction.
- `activate_skill` is always available, otherwise a second skill could never load.
- The declared names are the skill vocabulary (`file.read`, `code.write`),
  not the tool implementation names (`read_file`, `write_code`).

### New: chains

`chains.yaml` is now a runtime input:

```bash
agenthood workflow list
agenthood workflow run build "implement issue #42"
```

Each step runs through `MemberRunner`, so decisions, provenance and events match
a direct `agenthood run`. Sequential steps only. `guards.stop_on_blocking` stops
the chain on a `[blocking]` verdict; `max_rounds` re-runs the sequence while
budget remains. `doorman_before_merge` and `scribe_before_commit` are parsed as
policy but not enforced by the CLI runner.

### New: step-level traces

Trajectories now store one step per ReAct turn, with the tools called, tokens,
cost and active skills. Old single-step files still render.

```bash
agenthood trace visualize <id>
agenthood trace --skill builder
agenthood trace --tool read_file
```

### New: repository instructions

`AGENTS.md` (or `CLAUDE.md` when absent) at the project root is read at run
start and appended to each member's system prompt inside a
`<repo_instructions>` boundary. It is read-only, capped at 64 KB, and never
replaces the member role or safety guards.
