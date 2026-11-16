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
a direct `agenthood run`. A sequence entry is one of:

```yaml
sequence:
  - member: architect                      # a member runs the shared task
  - skill: refactor                        # `/refactor` activation, agent defaults to builder
    agent: builder
  - parallel:                              # branches run concurrently
      - member: reviewer
      - member: auditor
  - member: tester
    when: { step: reviewer, contains: "[blocking]" }
```

`skill:` steps are ordinary runs with the skill pre-activated, so budget, gating
and fallback apply exactly as they do for a model-driven activation. `parallel`
fails the group when one branch fails. `when` accepts `contains` or
`notContains` over an earlier step's output (a member or skill name, or a branch
label); a step that did not run fails closed, so a reference to a skipped step
skips the dependent one too. `guards.stop_on_blocking` stops the chain on a
`[blocking]` verdict; `max_rounds` re-runs the sequence while budget remains.
`doorman_before_merge` and `scribe_before_commit` are parsed as policy but not
enforced by the CLI runner.

### New: `compaction-replay` and cross-skill invocation

A skill that invokes another skill calls `activate_skill`; the activation block
is tagged `<skill_directives>` and survives compaction, so the invoking skill
resumes with its instructions. Set `compaction-replay: false` for instructions
that must not be replayed — compaction may summarise the body, and the next
activation re-injects it instead of returning an "already active" pointer.

Compaction now finds the activation marker inside the live `<tool_output>`
wrapper; before this, protection only matched a raw message, so it never fired in
a real run.

### New: skill delegation and context isolation

`delegate_task` accepts `skill` and `isolation` (`shared` default, `full`). A
skill name must resolve through discovery; `full` partitions the subagent's
artifacts and activated-skill scope and restores the caller's afterwards. Both
fields are optional — existing delegation calls behave as before.

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
`verify` fails without them. `compatibility`, `hidden`, `router`,
`disable-model-invocation`, `metadata.priority`, `metadata.conditions` and
`fallback` are optional. `metadata` itself is free-form — nested maps, lists and
booleans all survive.

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

### New: explicit activation, catalog formats, filtering

A task can start with `/skill-name` (or `/skill-name off`) to force a skill in or
out before the model sees it. Activation goes through `activate_skill`, so the
token budget, `metadata.conditions` and `fallback` chains apply either way.

The available-skills catalog is formatted for the provider: XML by default, JSON
for OpenAI-family models, plaintext for Google. Override with
`skills.catalogFormat` or per provider with `skills.providerFormats`. When no
skill is listable the whole catalog section is omitted rather than rendered
empty.

`disable-model-invocation: true`, `hidden: true` and `skills.disabled` in config
keep a skill out of the catalog without deleting it; `agenthood skills
--show-disabled` reports what is hidden and why. A config-disabled skill is also
refused by the tool. Catalog order is `metadata.priority` (0–100) descending,
then description length, then name.

```yaml
metadata:
  version: 1.0.0
  priority: 80
  conditions:
    - env:CI
    - file.exists:package.json
fallback: code-review
```

### New: running a skill's scripts

`activate_skill` now authorizes a second tool: `run_skill_script`. It runs a script
shipped under an activated skill's directory (or a version-pinned one-off command
such as `uvx ruff@0.8.0 check .`) with stdin closed, a timeout
(`skills.scriptTimeoutMs`, default 120000), and output capped at 30 KB — the rest
goes to `.agenthood/skill-output/<executionId>/` and is read back with `page`.

Runtime choice is by extension, then shebang: PEP 723 block → `uv run`, `npm:`
imports → `deno run`, otherwise `python`/`node`/`bash`. Unsupported languages are
refused rather than guessed. Every run appends a row to
`.agenthood/skill-exec-audit.ndjson`.

Community and experimental skills run only under `--sandbox` (Docker: no network,
read-only skill mount). Without Docker the run fails closed. Official skills and
`security.trustedAuthors` may run on the host. Activated skill directories are
readable without a prompt for the rest of the run, and each accepted read is
logged; `security.autoAllowSkillDirs: false` turns that off.

`agenthood verify --scripts` lints bundled scripts for agent-hostile interfaces
(stdin reads, no `--help`, prose when the skill declares JSON, exit codes outside
0/1/2, destructive branches without `--dry-run`, bare `exit 1`). Findings are
warnings, not failures.

### New: skills that cannot run here are hidden and refused

A skill may now declare what it needs, and the catalog only lists what this run
can actually use. The decision is one gate, computed at discovery and applied
again at activation, so a hidden skill cannot be activated by guessing its name.

```yaml
model-targets:
  provider: anthropic          # string or list, case-insensitive
  family: claude               # substring of the model id
  min-tokens: 200000
  exclude: [haiku]             # beats family
requires:
  tools: [mcp.github]          # unmet = blocked (mcp.x matches mcp.x.anything)
  optional-tools: [jq]         # unmet = warning
  context: 200000
dependencies:
  required: [code-review]      # must be installed and usable
  optional: [test-runner]
metadata:
  variants:
    haiku: references/compact.md   # longest matching fragment wins
```

Precedence is `exclude` > `family` > `provider`, and a structured field beats
the `compatibility` prose (which is read only for a `<n>K+ context` fallback).
A refusal names the requirement and the current model and suggests a switch; the
run never switches models on its own. A blocked skill with a `fallback` chain
follows it, like any other activation failure.

`verify` reports unknown tool names, dependencies that are not in the set, and
missing, escaping or shadowing variant files as warnings. A dependency cycle is
an error, because no run can activate it. `agenthood skills --show-disabled`
lists blocked skills with their reason.

Tool requirements are warnings at catalog time and blocks at activation: the
catalog is built before the run's tool registry exists.

### New: XDG user-scope skill paths

On Linux and macOS, user-scope skills resolve in this order, first match winning:

1. `$XDG_DATA_HOME/agents/skills`
2. `~/.local/share/agents/skills`
3. `~/.agents/skills` (legacy, still read)

On Windows the legacy `~/.agents/skills` stays the only user scope. Project
scopes and configuration are unchanged — only skill data moves.

### New: skill discovery and script output caching

Discovery now writes a metadata cache at `.agenthood/skill-cache/metadata.json`.
It is transparent: an entry is served only while the SKILL.md mtime and size
match, a miss re-parses, and entries for deleted skills are dropped. Rewriting a
file and restoring its original mtime is the one case a cached entry can be
stale; `agenthood cache clear` covers it. `agenthood skills --stats` prints the
scan counters (directories, skills, cache hits, duration) and says when the
2000-directory cap stopped a scan. `.gitignore` patterns are not parsed — the
built-in skip list covers `.git`, `node_modules`, `.venv`, `__pycache__`,
`.tox`, `vendor`, `target` and similar build/cache directories.

Script output caching is opt-in and off by default, because a bundled script may
mutate the workspace and a cached result would silently skip that mutation:

```json
{
  "skills": {
    "cacheOutputs": true,
    "cacheTtlMs": 3600000
  }
}
```

The cache is keyed by skill, script path, arguments and a digest of the script
file, so an edited script is never served from cache. One-off commands are never
cached. `no_cache: true` on a `run_skill_script` call bypasses it, and a hit is
stated in the tool output. `agenthood cache stats` reports both caches;
`agenthood cache clear` removes them.

`agenthood verify --tokens` warns when a SKILL.md body exceeds 5000 tokens
(`token-budget` in frontmatter overrides the limit) and reports the total.
`agenthood verify --dedup` reports one skill name installed in several roots and
suggests keeping the project copy. Both are advisory; runtime precedence still
decides which copy a run uses.

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

