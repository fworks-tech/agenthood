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
- When several skills are active, their declarations intersect: the most
  restrictive declaration wins, and a permissive skill cannot re-open a tool a
  restrictive active skill closed.
- Cross-client skills: a declared name that matches no agenthood tool is ignored
  at run time with a one-time warning, so a skill written for another client
  still loads. Ignoring a name never widens access; a skill whose declared names
  all resolve to nothing denies every tool. `agenthood verify` fails on such a
  name, so a typo is caught before merge.
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

### New: skill frontmatter fields

`metadata.version` (semver) and `license` are required on every member;
`verify` fails without them. `compatibility`, `hidden`, and `router` are
optional. `metadata` itself is free-form — nested maps, lists and booleans all
survive.

```yaml
---
name: my-skill
description: Use when …
license: MIT
compatibility: Requires Bash and git access
allowed-tools: file.read file.search
metadata:
  version: 1.0.0
  author: acme
---
```

`agenthood bump <member> --patch|--minor|--major` increments the version and
re-locks the member. The lock records it as `skillVersion` next to the hash.

### New: skill namespaces and `.well-known` catalogs

Publishing now requires a namespace: `metadata.author` is the `owner` in
`owner/name`, so a registry key no longer collides with an unrelated skill of
the same name. Local names and directories do not change — a slash is not a
portable directory name.

```bash
agenthood install @acme/lint
agenthood catalog https://skills.example.com
```

`agenthood install owner/name` resolves through the registry; only an argument
shaped exactly like a reference changes meaning, so existing URLs, git addresses
and paths behave as before. `agenthood catalog` lists `.well-known/agentskills`
catalogs configured under `remoteCatalogs` in `.agenthood/config.json`; the
token comes from an environment variable named by `tokenEnv` and is never stored
in config. See ADR-035.

