# AGENTS.md — The Member Registry

This file is the agent-agnostic convention source for the Agenthood.
All AI coding agents (Claude Code, Copilot, Gemini, Codex) should read this file
to understand the Society's standards before taking any action in a repository.

---

## Commit Standards

- Follow [Conventional Commits](https://www.conventionalcommits.org/) strictly
- Format: `type(scope): subject`
- Types: `feat`, `fix`, `docs`, `test`, `refactor`, `ci`, `chore`
- Subject: imperative, lowercase, ≤50 chars, no trailing period
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
