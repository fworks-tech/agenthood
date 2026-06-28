# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run build        # Compile TypeScript to dist/
npm run dev          # Watch mode
npm test             # Run all tests (vitest)
npm run lint         # ESLint on src/
npm run typecheck    # Type-check without emitting
```

Run a single test file:
```bash
npm test -- tests/commitlint.test.ts
npm test -- --reporter=verbose
```

Self-setup for the repo (installs git hooks and commit template):
```bash
make setup           # Runs: node dist/cli.js setup
```

The published CLI commands (for adopter projects, not for developing this repo):
```bash
npx agenthood init           # Interactive initiation ceremony
npx agenthood check          # Run Doorman health check
npx agenthood list           # Show active members
npx agenthood activate <member>
npx agenthood deactivate <member>
npx agenthood eject          # Remove Society from a project
```

## Architecture

Agenthood is a **multi-agent AI framework** distributed as an npm package + VS Code extension. It installs AI agent "skills" and software quality conventions into adopting projects.

### The 10-layer model

| Layer | Directory | Purpose |
|---|---|---|
| 1 — Conventions | `conventions/` | Commit templates, commitlint rules |
| 2 — Members | `members/` | Markdown-based AI agent skills |
| 3 — Rituals | `rituals/` | Scheduled automations (morning-briefing, watchman, etc.) |
| 4 — Portals | `portals/` | External connectors (GitHub, Linear, Jira, Slack, Sentry) |
| 5 — Agentic Workflows | `agentic-workflows/` | Manual prompt templates (triage, review PR, diagnose CI) |
| 6 — CI | `.github/workflows/` | GitHub Actions enforcing every layer |
| 7 — Runtime | `src/` | TypeScript CLI + autonomous runtime (`agenthood run`) |
| 8 — Memory & RAG | `src/memory/`, `src/rag/` | Memory tiers, KnowledgeGraphStore, RAG pipeline, Tree-sitter, LanceDB |
| 9 — Workflows | _not yet implemented_ | Multi-member orchestration (AgentStep, ParallelStep, HumanInLoop) — 📋 Planned |
| 10 — Evals | `src/evals/` | EpisodeLearner shipped; EvalRunner, quality metrics — 📋 Planned |

### CLI source (`src/`)

Entry point is `src/cli.ts` — it parses args and dispatches to `src/commands/<command>.ts`. Commands are:
- `init.ts` — Interactive ceremony: prompts, copies conventions + hooks + skills, initializes vector store and residual memory, writes `.agenthood/config.json`
- `setup.ts` — Self-setup for this repo (sets git hooks path, chmod, installs commit template)
- `check.ts` — Health check validating all installed components
- `activate.ts` / `deactivate.ts` — Copy or remove a member skill file into a project
- `list.ts`, `oath.ts`, `eject.ts` — Utility commands

The CLI's production dependencies include `@anthropic-ai/sdk`, `groq-sdk`, `openai` (LLM providers), `@lancedb/lancedb` (vector store), `ajv` (schema validation), and `tree-sitter` (code parsing). The CLI also uses Node.js built-ins (`fs`, `path`, `child_process`, `readline`, `parseArgs`).

### Members (`members/`)

specialized agent skills, each a Markdown file (`members/<name>/SKILL.md`). They are **agent-agnostic** — designed to work with Claude Code, GitHub Copilot, OpenAI Codex, CodeBuddy, and others. Key members:
- **the-scribe** — N+1 commit pattern, PR "no and" test, changelog generation, Conventional Commits enforcement
- **the-architect** — Interview mode to 95% confidence, spec-first development, task decomposition, stacked branch planning
- **the-reviewer** — Five-axis review (Correctness, Readability, Architecture, Security, Performance), test-first review, change sizing
- **the-doorman** — Commit/PR validation, health checks, branch protection, hook setup (POSIX + Husky)
- **the-strategist** — Goal refinement, requirement discovery, ambiguity resolution
- **the-operator** — Runtime health, deployment verification, rollback execution, incident triage
- **the-steward** — Context gauge, minimal member routing, provider cache strategies, session triage at capacity thresholds
- **the-envoy** — Provider detection (7 runtimes), skill translation, convention validation, bootstrap mode

### Orchestrator pattern (ADR-005)

Agent coordination flows through an orchestrator rather than peer-to-peer:
```
User Request → ConcurrencyQueue → Orchestrator →
Member Execution → SafetyGuard → ProviderFailover → Response
```

### Conventions enforcement

Commit quality is enforced at three points simultaneously (ADR-003):
1. **`.githooks/commit-msg`** — Local Doorman validation
2. **`.githooks/pre-commit`** — Blocks commits to main, audits secrets, checks file sizes
3. **`.github/workflows/commitlint.yml`** — CI re-validates on PRs

Banned commit subjects include: `wip`, `fix stuff`, `update`, `changes`, `stuff`, `misc`, `temp`, `test`, `asdf`. The custom rule lives in `conventions/commitlint.config.ts` and is tested in `tests/commitlint.test.ts`.

### VS Code extension (`vscode-extension/`)

Separate package (`agenthood-vscode`) wrapping the same commands. Activates when `.gitmessage` or `commitlint.config.ts` is found in the workspace. Has its own `package.json` and `dist/` build.

### Releases

Managed by `semantic-release` (config in `.releaserc.json`). Releases cut from `main` automatically via `.github/workflows/semantic-release.yml`. Changelog is auto-generated; do not edit `CHANGELOG.md` manually.

## Key conventions

- **ESM throughout** — `"type": "module"` in package.json; use `import`/`export`, not `require`
- **Strict TypeScript** — `tsconfig.json` has strict mode; run `npm run typecheck` before committing
- **Member directories** follow the pattern `members/the-<name>/SKILL.md`
- **Tests mirror source** — `tests/commands/` mirrors `src/commands/`
- **All install operations are idempotent** — safe to run `init`, `setup`, `activate` multiple times
- **ADRs live in `docs/adr/`** — add one for significant architectural decisions
