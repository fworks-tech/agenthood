# Agenthood

[![npm version](https://img.shields.io/npm/v/agenthood?style=flat-square&logo=npm)](https://www.npmjs.com/package/agenthood) [![npm downloads](https://img.shields.io/npm/dm/agenthood?style=flat-square&logo=npm)](https://www.npmjs.com/package/agenthood) [![PR Standards](https://img.shields.io/github/actions/workflow/status/fworks-tech/agenthood/pr.yml?style=flat-square&label=PR%20standards)](https://github.com/fworks-tech/agenthood/actions/workflows/pr.yml) [![License: MIT](https://img.shields.io/badge/License-MIT-blue?style=flat-square)](LICENSE) [![Node.js](https://img.shields.io/badge/node-%3E%3D22.14.0-brightgreen?style=flat-square&logo=node.js)](https://nodejs.org) [![skills.sh](https://skills.sh/b/fworks-tech/agenthood)](https://skills.sh/fworks-tech/agenthood) [![SkillsMP](https://img.shields.io/badge/registry-SkillsMP-purple?style=flat-square)](https://skillsmp.com/creators/fworks-tech) [![Security: self-audited](https://img.shields.io/badge/security-self--audited-blue?style=flat-square)](docs/security-audit-report.md)

**A full AI engineering team that earns every merge.**

Twenty members: architect, reviewer, security auditor, DevOps engineer,
strategist, operator, and the rest of the roles a software project actually
needs. Each one is a single Markdown skill file that any agent runtime can
load. A TypeScript runtime runs them autonomously across the lifecycle, from
planning to release.

What earns the merge is the record. Every run a member takes writes a
decision (what was chosen, what was rejected, and why), a provenance entry
chained by SHA-256 so a later edit is visible, and an invocation trace. This
repository's own CI runs under the same discipline: a reviewer comment that
states the commit it read and the scope it covered, a skipped review that
announces its reason instead of passing green, a security exception that
carries an expiry date. The record is the product; the members are how it
gets written.

That is the answer to the question this page exists for: why trust what this
repository does. The claim is not taken on faith. [The evidence](#the-evidence)
section links to live runs and comments from this repository's CI that you
can open and check.

[Quick start](#quick-start) · [What's new in 4.3](#whats-new-in-43) · [The evidence](#the-evidence) · [The team](#the-team) · [Commands](#command-reference) · [Upgrade from 3.x](MIGRATION.md)

---

## Two ways to run it

| Mode | What happens | Best for |
|------|--------------|----------|
| **Skill mode** | Members load as Markdown skill files into Claude Code, Copilot, Gemini CLI, Cursor, OpenCode, or any runtime that reads skills | Working inside an assistant you already use |
| **Runtime mode** | `agenthood run` executes a member as an LLM agent with tools, checkpoints, and an audit trail | CI automation, batch work, and multi-step chains |

Both modes read the same member definitions, so a rule you rely on in one mode
holds in the other.

---

## Quick start

Requirements: Node.js 22.14 or newer, `git`, and the `gh` CLI if you want PR
sync. No API key is needed to install and load the members.

```bash
npm install --save-dev agenthood
npx agenthood init       # interactive setup, about 2 minutes
npx agenthood check      # confirm the Society is operational
```

`init` installs the member skills into the skill directory of the runtime you
pick, activates the git hooks, and writes the PR template and commit template.

To run members as autonomous agents instead, point one at a task:

```bash
npx agenthood run scribe "write a commit message for the current diff"
npx agenthood run reviewer "review the changes in the last commit"
npx agenthood run architect "plan the implementation for issue #42"
```

The runtime defaults to OpenCode and works with a free Groq key. See
[Groq zero-cost setup](docs/guides/groq-zero-cost-setup.md) or
`npx agenthood doctor` when a provider is not answering.

Not using npm? `npx skills add fworks-tech/agenthood` installs the same skills
through [skills.sh](https://skills.sh/fworks-tech/agenthood).

### Your first commit

1. **Write code.** Make the change.
2. **Stage it.** `git add -p`
3. **Commit.** The Doorman validates the message against Conventional Commits. On a failure you get the reason and a suggested subject.
4. **Push.** Pre-push hooks run the tests before the branch leaves your machine.
5. **Open the PR.** The body arrives pre-filled with `## What changed`, `## Why`, and `## How to test`.
6. **Review.** The Reviewer checks correctness, security, performance, maintainability, and coverage.

Nine CI workflows enforce the same standards on the server, including an
advisory review comment from the Reviewer on every pushed diff. The full
matrix is in [Getting Started](docs/academy/getting-started.md#ci-pipeline).

---

## What's new in 4.3

- **The trail is auditable end to end.** `agenthood audit` replays decisions,
  provenance and routing records as one ordered timeline and verifies the
  SHA-256 chain. `--strict` exits 1 on a broken chain, a gap or an unreadable
  file; `--clear` archives the trail and starts clean
  ([#1113](https://github.com/fworks-tech/agenthood/pull/1113), 4.2).
- **Runs carry their numbers.** The audit joins each run to its trace, so the
  timeline shows duration, cost and tokens per run; a corrupt or missing trace
  decorates nothing and never fails the audit
  ([#1117](https://github.com/fworks-tech/agenthood/pull/1117)).
- **Routing is a first-class record.** `agenthood route` writes a validated
  routing decision from JSON on stdin: a wrong-typed field fails closed and
  nothing is written
  ([#1118](https://github.com/fworks-tech/agenthood/pull/1118)).
- **The reviewer reads a real diff and never gates.** The Reviewer receives
  up to 100 KB of the actual `git diff`, posts findings with the scope it
  covered, and its verdict is advisory: what stops a merge are the
  deterministic checks ([ADR-046](docs/adr/ADR-046-automated-review-authority.md)).
- **Skips are visible.** A review that cannot run (no pull request context,
  no API key) says so in the PR thread or the run summary, instead of leaving
  a green check that reviewed nothing.

Breaking changes from 4.0 are in [MIGRATION.md](MIGRATION.md). The full
history is in the [release notes](docs/release-notes.md).

---

## The evidence

The claims above, checked against this repository's own CI.

**A reviewer with real input.** On PR
[#1087](https://github.com/fworks-tech/agenthood/pull/1087#issuecomment-6966824192)
the Reviewer read an 8 file, 19 KB diff at commit `f5f4e7a8` and returned
"no blocking findings, 3 warnings", with a scope line stating the commit, the
changed-file count, the diff size, and what the exclusions left out.

**A verdict that survives a rerun.** Two `workflow_dispatch` runs on the same
commit (`348f63c1`) returned the same verdict, "no blocking findings, 3
warnings": run
[44215065350](https://github.com/fworks-tech/agenthood/actions/runs/44215065350)
and run
[44215545410](https://github.com/fworks-tech/agenthood/actions/runs/44215545410).
The same-SHA flip that motivated
[ADR-046](docs/adr/ADR-046-automated-review-authority.md) cannot decide a
merge anymore, because the verdict no longer gates.

**Accepted risk with an expiry.** The dependency audit carries an exception
for GHSA-fc5q-39xc-vjpf in
[audit-filter.mjs](.github/scripts/audit-filter.mjs), scoped to the affected
dependency and expiring 2027-02-01
([ADR-043](docs/adr/ADR-043-dependency-audit-exception-policy.md)). It is an
exception you can read and watch expire, not a bypass.

### Where the model does not decide

No merge in this repository depends on a model verdict. The checks that stop
a merge are deterministic: commitlint, the test suite, the build, the link
and prose checks, and the Sentinel's structural checks. Model analyses run
advisory ([ADR-046](docs/adr/ADR-046-automated-review-authority.md)); a model
finding becomes a merge blocker only when someone turns it into a failing
test, a lint rule, or a link check.

One honest residue: the Herald's CI summary fires on `workflow_run`, which
executes the default branch's code. A change to the Herald reaches its own
comments only after it merges; the duplicated Reviewer row on PR #1087 was
that delay, not a broken fix.

---

## The Oath

> *I commit with intention.*
> *I branch with purpose.*
> *I review with honesty.*
> *I ship with confidence.*
> *I never push to main.*

Each line maps to something the tooling enforces: commitlint on the message,
branch naming against the issue, required checks on the pull request, a green
pipeline before release, and branch protection on `main`. The full reading is in
[oath.md](oath.md).

---

## The team

Twenty members, each with its own checklist and its own lane.

| | Member | Role |
|---|--------|------|
| 🎯 | [The Strategist](skills/strategist/SKILL.md) | Goal refinement, requirement discovery |
| 🏗️ | [The Architect](skills/architect/SKILL.md) | System design, ADRs, technical decisions |
| 🔮 | [The Oracle](skills/oracle/SKILL.md) | Institutional knowledge, authoring templates |
| 🛠️ | [The Builder](skills/builder/SKILL.md) | Implementation, refactoring, local validation |
| 🧪 | [The Tester](skills/tester/SKILL.md) | TDD, coverage, edge cases |
| 🐛 | [The Debugger](skills/debugger/SKILL.md) | Error triage, root cause analysis |
| ⚖️ | [The Warden](skills/warden/SKILL.md) | Code health, complexity enforcement |
| 🔍 | [The Reviewer](skills/reviewer/SKILL.md) | Code review, standards enforcement |
| 🔒 | [The Auditor](skills/auditor/SKILL.md) | Security review, dependency audit |
| 👁️ | [The Sentinel](skills/sentinel/SKILL.md) | Integrity, cross-member contradiction detection |
| 🚪 | [The Doorman](skills/doorman/SKILL.md) | Validation, branch protection, health checks |
| ✍️ | [The Scribe](skills/scribe/SKILL.md) | Commit messages, PR descriptions, changelogs |
| 📦 | [The Herald](skills/herald/SKILL.md) | Releases, versioning, release notes |
| 📝 | [The Librarian](skills/librarian/SKILL.md) | Documentation, API references |
| 🩺 | [The Operator](skills/operator/SKILL.md) | Runtime health, deployments, rollback |
| 🧭 | [The Steward](skills/steward/SKILL.md) | Context economy, provider cache strategy |
| 🚦 | [The Mediator](skills/mediator/SKILL.md) | Intent routing, handoff sequencing |
| 🌐 | [The Envoy](skills/envoy/SKILL.md) | Cross-provider translation, convention validation |
| 📬 | [The Mailman](skills/mailman/SKILL.md) | Message delivery, scheduling, cross-posting |
| 👁️ | [The Inspector](skills/inspector/SKILL.md) | Visual-reasoning benchmarking, pixel analysis |

Beyond the members, `skills/` ships 23 utility skills: specialist capability
files for docker, kubernetes, postgres, redis, jira, sentry, and more. Any agent
runtime activates them when the task matches. See the
[utility skills guide](docs/academy/utility-skills.md).

### Community members

Third-party members live in `skills/contrib/` and are listed here after review.
No community member has been published yet, so the first row is yours.

| Member | Author | Specialty | Install |
|--------|--------|-----------|---------|
| _The Translator_ | _@example_ | _Tech-to-plain-language_ | `npx agenthood install @example/the-translator` |

The row above shows the format, not a published member. To add one, open a PR
with your `skills/contrib/the-<name>/SKILL.md` and your row. The walkthrough is
[Creating a Member](docs/guides/creating-a-member.md) and the contract is
[Third-Party Members](docs/members/contrib-members.md).

---

## Chains

A chain is a YAML declaration, not a script. Members run in order, guards decide
when to stop, and every step keeps the same traces and provenance records as a
single run.

```yaml
# chains.yaml
chains:
  - name: build
    sequence:
      - member: tester
      - member: builder
      - member: reviewer
      - member: doorman
    guards: { stop_on_blocking: true, doorman_before_merge: true, scribe_before_commit: true }
    max_rounds: 3
```

```bash
npx agenthood workflow list                      # declared chains and built-in workflows
npx agenthood workflow run build "implement issue #42"
npx agenthood workflow review-pr                 # built-in workflow
```

Nine chains ship with the project, among them `build`, `review`, `security`,
`planning`, and `bug`. Design notes are in [chain-workflows.md](docs/architecture/chain-workflows.md)
and [ADR-033](docs/adr/ADR-033-chain-workflows.md).

---

## Command reference

### Setup

| Command | What it does |
|---------|--------------|
| `agenthood init` | Install hooks, templates, and member skills. `--ci` runs it unattended |
| `agenthood check` | Run the Doorman health check |
| `agenthood doctor` | Diagnose node, version, config, API keys, providers, skills, lockfile, and hooks in one pass |
| `agenthood eject` | Remove every Society file from the project |

### Members

| Command | What it does |
|---------|--------------|
| `agenthood list` | List members with status, permission profile, and provider |
| `agenthood run <member> "<task>"` | Run a member as an LLM agent. `--detect` picks the members for the task |
| `agenthood activate <member>` | Enable a member's skill file in your runtime |
| `agenthood deactivate <member>` | Disable a member's skill file |
| `agenthood verify` | Validate skill integrity, spec conformance, and the lockfile. `--strict` adds lane overlap and injection checks |
| `agenthood diff [member]` | Compare a skill against the version locked in `agenthood.lock` |
| `agenthood rollback [member]` | Restore a skill from the lockfile |

### Observability

| Command | What it does |
|---------|--------------|
| `agenthood status` | Project health and member metrics. `--watch` polls, `--drift` compares against the lockfile |
| `agenthood stats` | Per-skill usage: activations, trigger rate, error rate |
| `agenthood trace` | Recent invocation traces. `--activations` shows which skill loaded when |
| `agenthood audit` | Replay the decision trail in order and verify the hash chain. `--strict` fails on a gap, `--clear` archives the trail |
| `agenthood route` | Write a validated routing decision from JSON on stdin |
| `agenthood log` | Structured log entries, filterable by level, member, and time |
| `agenthood checkpoints` | List past run checkpoints |
| `agenthood cost` | Cumulative spend by provider, member, and day |
| `agenthood health` | Runtime health checks. Exit codes 0 healthy, 1 degraded, 2 unhealthy |
| `agenthood metrics` | Export metrics to Prometheus or StatsD |

### Skills and workflows

| Command | What it does |
|---------|--------------|
| `agenthood skills` | List discovered skills in catalog order and what was filtered out |
| `agenthood search` | Search the skill registry |
| `agenthood install <url>` | Install a skill from a URL, a git repository, or a registry reference |
| `agenthood create <name>` | Scaffold a skill directory with a `SKILL.md` template |
| `agenthood update` / `upgrade` | Compare or upgrade installed skill copies |
| `agenthood workflow list` | Declared chains and built-in workflows |
| `agenthood workflow run <chain> "<task>"` | Run a chain |
| `agenthood ritual run <name>` | Run a declared ritual, which binds a schedule to a member |
| `agenthood goal` | Track a multi-step goal: subgoals, status, next step |
| `agenthood eval <member> --suite <path>` | Scored eval run with baseline gating |
| `agenthood optimize <member>` | Rewrite a member description against trigger accuracy |
| `agenthood mcp` | Expose the skills as MCP tools |
| `agenthood pr-sync --pr <N>` | Sync the PR body with commits landed since the last sync |
| `agenthood oath` | Print the oath |

Every command takes `--help`, and `npx agenthood help` prints the full list.

---

## How a run is recorded

Each member run leaves four artifacts under `.agenthood/`:

| Path | Content |
|------|---------|
| `decisions/` | One decision record per run: what was chosen, what was rejected, and why |
| `provenance/` | A SHA-256 hash chain over those records, so a later edit is visible |
| `routing/` | One routing record per Mediator decision, written by `agenthood route` |
| `traces/traces.ndjson` | Every invocation trace and log entry, under one retention policy |

```bash
npx agenthood audit            # the trail in order, chain verified, metrics attached
npx agenthood trace --member reviewer
npx agenthood status --member reviewer
```

The reasoning behind the schema is in
[decision-intelligence.md](docs/architecture/decision-intelligence.md) and
[ADR-015](docs/adr/ADR-015-decision-intelligence-and-provenance.md). This is the
part a reviewer can check months later: which agent decided what, on which
inputs, in which order.

---

## Compatibility

The skill files load into:

- [Claude Code](https://claude.ai/code): via `.claude/skills/`
- [GitHub Copilot](https://github.com/features/copilot): via `.github/copilot-instructions.md`
- [Gemini CLI](https://github.com/google-gemini/gemini-cli): via skill files
- [Cursor](https://cursor.com): via skill files
- [OpenCode](https://opencode.ai): via the plugin below, or as skill files
- Any runtime that reads skill files or `AGENTS.md`

The runtime ships seven providers: OpenCode (default), OpenCodeGo, Groq
([free tier](https://console.groq.com)), OpenRouter, Anthropic, OpenAI, and
Ollama for fully offline execution. Configure them in `.agenthood/config.json`,
or override per run with `--provider`.

### opencode plugin

Install once, then the plugin loads the members in every project:

```bash
npm i -g agenthood   # add @<version> to pin, for example agenthood@4.3.0
```

```jsonc
// ~/.config/opencode/opencode.jsonc  (global)
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": ["agenthood"]
}
```

```jsonc
// ./opencode.json  (project)
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": ["agenthood"]
}
```

The plugin registers all 20 member skills and an `agenthood_run_member` tool.
It cannot create agents, so the primary `agenthood-live` orchestrator comes from
an `agents` block in your config. Copy the one in this repo's `opencode.json`.
A member run has a five-minute watchdog; set `AGENTHOOD_MEMBER_TIMEOUT_MS` to
change it.

The VS Code extension (`agenthood-vscode`) runs the same runtime inside the
editor. Its source is in [vscode-extension/](vscode-extension/) and it
packages to a `.vsix` with `npm run package`. The marketplace publish runs
when a GitHub release is published and the `VSCE_TOKEN` secret is set, so
there is no marketplace listing yet.

---

## Custom members

A host that embeds Agenthood as a library can register its own members. Custom
members run through the same ReAct loop, tool registry, checkpoints, events, and
audit trail as the built-in Society. There is no second execution path.

```ts
import { ApplicationContext } from 'agenthood/dist/runtime/ApplicationContext.js'
import type { CustomMemberDefinition } from 'agenthood/dist/members/types.js'
import type { LLMConfig } from 'agenthood/dist/llm/types.js'

const releaseCaptain: CustomMemberDefinition = {
  name: 'release-captain',             // [a-z0-9][a-z0-9-]{1,63}, must not collide
  description: 'Owns release readiness for one product',
  systemPrompt: 'Verify the checklist before shipping.', // body only, no frontmatter
  permissionProfile: 'restricted',     // default
  tools: ['file.read', 'file.search'], // intersected with the profile, never widens it
  model: 'claude-sonnet-5-5',          // optional per-member model
}

const config: LLMConfig = { providers: [{ name: 'anthropic' }] }

const app = await ApplicationContext.create(process.cwd(), config, {
  customMembers: [releaseCaptain],
})

await app.runner.runMemberTask('release-captain', 'is v4 ready?', config)
```

`app.members.list()` returns built-ins and custom members together.
`app.members.register(def)` works after composition. Registration is
append-only: a name collision, an invalid slug, an empty or oversized system
prompt, and a duplicate all throw. Declared `tools` can only narrow the
permission profile. A custom member has no `SKILL.md` on disk, so the integrity
gate does not apply to it: the host owns the content.

---

## Studio

[**Agenthood Studio**](https://agenthood.flabs.tech/studio/playground) is a
browser front end for the same runtime: every request runs through
`agenthood/dist/llm` with provider routing, failover, and streaming.

[**Workspaces**](https://agenthood.flabs.tech/studio/workspaces) assemble a team
for one instruction. The Mediator plans the handoff sequence, the members run in
order, and a synthesizer streams the final answer, with a human checkpoint to
pause, review, continue, or stop.

The source is [agenthood-site](https://github.com/fworks-tech/agenthood-site).

---

## Documentation

- [Getting Started](docs/academy/getting-started.md): install, first commit, CI, configuration
- [Skills Reference](docs/academy/skills-reference.md): every member, its tools, and how to invoke it
- [Utility Skills](docs/academy/utility-skills.md): the 23 specialist skills
- [Patterns](docs/patterns/README.md): four workflow patterns mapped from deepagents onto the Society
- [Runtime Guide](docs/runtime-guide.md): configuration, providers, and operations
- [Architecture](docs/architecture/README.md): agent system, queues, operating modes, failover, tools, decisions, skills
- [ADRs](docs/adr/): 44 records of the decisions behind the design
- [Academy](docs/academy/): a learning path from "what is a prompt" to shipping agents, across three levels
- [Troubleshooting](docs/guides/troubleshooting.md): the failures people hit first

---

## Development

```bash
npm install
npm run build
make setup           # activate hooks and the commit template
npm test             # full test suite
npm run typecheck    # strict TypeScript check
npm run lint         # ESLint
npm run lint:prose   # house prose style
```

Directory layout is in [STRUCTURE.md](STRUCTURE.md), contribution rules are in
[CONTRIBUTING.md](CONTRIBUTING.md), and the security policy is in
[SECURITY.md](SECURITY.md). [CHANGELOG.md](CHANGELOG.md) is generated by
semantic-release, so fix the commit, not the changelog.

---

## References

- [Conventional Commits](https://www.conventionalcommits.org/)
- [addyosmani/agent-skills](https://github.com/addyosmani/agent-skills)
- [opencode](https://github.com/sst/opencode): default LLM provider
- [semantic-release](https://github.com/semantic-release/semantic-release)
- [commitlint](https://commitlint.js.org/)

---

*Open source. No sign-up. Works with any agent runtime.*
*Membership is free. Standards are not.*
