# AGENTS.md — The Member Registry

This file is the agent-agnostic convention source for the Agenthood.
All AI coding agents (Claude Code, Copilot, Codex) should read this file
to understand the Society's standards before taking any action in a repository.

---

## Commit Standards

- Follow [Conventional Commits](https://www.conventionalcommits.org/) strictly
- Format: `type(scope): subject`
- Types: `feat`, `fix`, `docs`, `test`, `refactor`, `ci`, `chore`
- Subject: imperative, lowercase, ≤150 chars, no trailing period
- One logical change per commit — if in doubt, split it
- Never write: `fix stuff`, `wip`, `update`, `changes`, `misc`, `asdf`

## Branch Standards

- One branch per issue: `type/issue-NUMBER-short-description`
- Never commit directly to `main`
- Branch names are lowercase, hyphenated, no spaces

## Pull Request Standards

- Every PR links to an issue via `Closes #N` or `Fixes #N`
- PR title follows the same Conventional Commits format as commits
- PR description answers: what changed, why, how to test
- All CI checks must pass before merge

## Agent Behavior Rules

- Always create a branch before making changes
- Always run tests before considering a task complete
- Always prefer editing existing files over creating new ones
- Never add comments that explain *what* — only *why* when non-obvious
- Never introduce abstractions beyond what the task requires
- Never push to remote without explicit user confirmation
- Never merge without explicit user confirmation

## The Members

Load skills from `docs/members/` to activate specialized agents:

- `the-scribe` — commit messages, PR descriptions, changelogs
- `the-architect` — spec-driven development, planning, ADRs
- `the-reviewer` — code review, quality gates
- `the-tester` — TDD, test generation, coverage
- `the-debugger` — error triage, root cause analysis
- `the-auditor` — security review, dependency audit
- `the-herald` — semantic versioning, release notes
- `the-librarian` — documentation, knowledge management
- `the-doorman` — validation, health checks, enforcement
- `the-oracle` — institutional knowledge, member authoring templates, naming guidance
- `the-envoy` — cross-provider translation, bootstrap generation, convention validation
- `the-sentinel` — Society document integrity, cross-member contradiction detection, structural drift
- `the-warden` — code smell detection, complexity enforcement, architectural boundary violations
- `the-steward` — context economy, member routing, provider cache strategy, session triage
- `the-operator` — runtime health, deployment, incidents, rollback, monitoring
- `the-strategist` — goal refinement, requirement discovery, ambiguity resolution

## Autonomous Runtime (agenthood run)

Members can also be executed as real LLM agents via the TypeScript runtime.
This is optional and additive — the prompt-driven workflow above continues to work unchanged.

```bash
# Build the runtime (once, after install)
npm run build

# Set the LLM provider key in your environment (do NOT commit it)
# Set GROQ_API_KEY in your shell profile or CI secrets (free at console.groq.com)
# or use Ollama for fully offline execution — no key required

# List available members
npx agenthood list

# Invoke any member against a task
npx agenthood run the-scribe "write a commit message for the current diff"
npx agenthood run the-reviewer "review the open PR"
npx agenthood run the-architect "plan the implementation for issue #42"
```

The runtime reads `.agenthood/config.json` (written by `npx agenthood init`) and respects
the same `members`, `permissions`, and `toolScoping` configuration. The default LLM
provider is Groq (free tier). See [ADR-008](docs/adr/ADR-008-typescript-runtime-over-python.md)
and [ADR-009](docs/adr/ADR-009-groq-as-default-llm-provider.md) for design decisions.

> **ADR-008** supersedes the earlier Python/DeepAgents runtime approach.
> The TypeScript CLI in this repo is the single supported runtime for `agenthood run`.
