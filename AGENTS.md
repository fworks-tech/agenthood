# AGENTS.md — The Member Registry

This file is the agent-agnostic convention source for the Agenthood.
All AI coding agents (Claude Code, Copilot, Gemini, Codex) should read this file
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

Load skills from `members/` to activate specialized agents:

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

## Autonomous Runtime (agenthood-run)

Members can also be executed as real LLM agents via the Python runtime layer.
This is optional and additive — the prompt-driven workflow above continues to work unchanged.

```bash
# Install
pip install "agenthood-runtime @ git+https://github.com/fworks-tech/agenthood.git#subdirectory=runtime"

# Required environment variables
# Set the Anthropic API key in your environment or CI (do NOT commit it)
export AGENTHOOD_ROOT=/path/to/agenthood

# Invoke any member
agenthood-run invoke the-scribe "write a commit message for the current diff"
agenthood-run invoke the-reviewer "review the open PR"
agenthood-run list    # show all 14 members
```

The runtime reads `.agenthood/config.json` (written by `npx agenthood init`) and respects
the same `members`, `permissions`, and `toolScoping` configuration. Members execute via
DeepAgents + LangGraph with full session resumability via `--thread-id`.

See [runtime/](runtime/) and [ADR-006](docs/adr/ADR-006-python-runtime-as-additive-layer.md) for details.
