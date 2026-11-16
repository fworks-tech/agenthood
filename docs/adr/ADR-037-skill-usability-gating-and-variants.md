# ADR-037: Skill Usability Gating, Variants and Global Scope

**Date:** 2026-11-16
**Status:** Accepted

## Context

Batch E asks eight versions of one question: *can this skill run here?* A skill may
need a 200K context window (#549, #553), a tool or an MCP server (#552, #554), another
skill (#571), a model family (#549), and a body written for a different model (#551).
Today the catalog lists everything discovered. The model activates what looks relevant
and discovers the mismatch only when the run fails (#555).

Deciding this per feature would give five filters with five different rules and five
different failure messages. It is one decision, made once, before the catalog is
rendered.

## Decision

### 1. One gate, computed at discovery

`gateSkills(manifests, availability)` is a pure function in
`src/skills/discovery/gating.ts`. It returns:

- `active`: usable here, catalogued and activatable;
- `blocked`: `Map<name, reason>`; out of the catalog and refused by `activate_skill`
  with that reason;
- `warnings`: `Map<name, string[]>`; optional gaps that do not block activation.

Availability is injected: `{ provider, model, contextWindow, tools, skills }`. No filter
reads the environment. Tests pass a literal.

A blocked skill is **refused at activation**, not merely hidden. Cataloguing a skill
that cannot run invites an activation that must fail; that is the wasted turn this
batch exists to remove.

### 2. Declared requirements are structured; prose is documentation

```yaml
model-targets:
  provider: anthropic          # string or list; case-insensitive exact match
  family: claude               # substring of the model id
  min-tokens: 200000
  exclude: [haiku, gpt-4o-mini] # substring match: blocked even if family matches
requires:
  tools: [bash, mcp.github]    # required; unmet = blocked
  optional-tools: [jq]         # unmet = warning only
  context: 128000              # same meaning as model-targets.min-tokens
dependencies:
  required: [code-review]
  optional: [test-runner]
metadata:
  variants:
    opus: references/opus.md
    haiku: references/compact.md
```

- `compatibility` stays prose. One pattern is read from it: `<n>K+ context` or
  `<n> token context`, and only as a fallback when no structured context requirement
  exists. Parsing English for the rest would be a guess dressed as a rule.
- A tool requirement matches the session tool list by exact name. An `mcp.` prefix
  matches any registered tool under it (`mcp.github` matches `mcp.github.create_issue`).
- A dependency must be discovered **and** active. If a required dependency is itself
  blocked, the dependent is blocked with that reason, transitively.
- A cycle among required dependencies blocks every skill in the cycle, and the reason
  names the cycle path. It is not an error to install one; it is an error to activate.
- Optional tools and optional dependencies produce a warning inside the activation
  block and do not block.

### 3. Precedence

`exclude` beats `family`; `family` beats `provider`; a structured requirement beats
prose. A skill with no requirements is always active. Contradictory declarations are a
`verify` error, not a runtime surprise.

### 4. Variants are files inside the skill directory

`metadata.variants` maps a model-id fragment to a markdown file. Selection takes the
longest matching fragment (`claude-opus-4` beats `opus`). The chosen file is resolved
under the skill directory, the same boundary as every other reference (#542), and
missing or escaping targets fall back to the default body with a warning. Variants
replace the instructions only; frontmatter-driven behaviour is unchanged.

`verify` checks that every variant file exists, stays inside the directory, and does
not shadow the default body by pointing at it under another name.

### 5. Model-switch advice is advisory

When a skill is blocked by model constraints only, the refusal names what is required
(`provider anthropic`, `min 200000 tokens`, the current model) and suggests a switch.
Nothing switches automatically: a model change mid-task invalidates the transcript's
assumptions, and the user owns that call. One log line records the recommendation.

### 6. Global scope follows XDG (#523)

User scope resolves, in order:

1. `$XDG_DATA_HOME/agents/skills`
2. `~/.local/share/agents/skills` (XDG default when the variable is unset)
3. `~/.agents/skills` (legacy, still read)

The first directory wins; later ones remain readable so an existing install keeps
working. On Windows, where XDG does not apply, `~/.agents/skills` stays the user scope.
Configuration is project-scoped and unchanged: only skill *data* moves.

## Consequences

- New frontmatter fields are optional; no existing skill changes meaning.
- `discoverSkills` gains an availability argument; `agenthood skills --show-disabled`
  reports blocked reasons alongside hidden ones.
- `verify` gains rules for unknown tool names, missing dependency names, cycles, and
  variant files. Warnings stay warnings; a cycle is an error.
- The activation tool reads one extra file when a variant matches.
- Tests exercise the gate as a pure function; no filesystem and no provider calls.
- The catalog is built before a run's tool registry exists, so tool requirements
  are warnings at discovery time and block at activation, where the session tool
  list is known. Model, provider, context and dependency requirements block in
  both places.

## Alternatives considered

| Option | Rejected because |
|---|---|
| Five independent filters | Five rule sets, five messages, and an order nobody can explain |
| Hide blocked skills but allow activation | The model finds them in prose or docs and hits the same failure later |
| Parse `compatibility` prose fully | A prose parser is a guessing machine; structured fields are testable |
| Auto-switch model on activation | Invalidates the transcript's assumptions without consent |
| Block on optional dependencies | Graceful degradation is the point of "optional" |
| Move config into XDG too | Breaking change with no user ask; skills are data, config is project state |
