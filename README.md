# Agenthood

[![npm version](https://img.shields.io/npm/v/agenthood?style=flat-square&logo=npm)](https://www.npmjs.com/package/agenthood) [![npm downloads](https://img.shields.io/npm/dm/agenthood?style=flat-square&logo=npm)](https://www.npmjs.com/package/agenthood) [![License: MIT](https://img.shields.io/badge/License-MIT-blue?style=flat-square)](LICENSE) [![Node.js](https://img.shields.io/badge/node-%3E%3D20-brightgreen?style=flat-square&logo=node.js)](https://nodejs.org)

> A full AI engineering team as plain Markdown files.

14 specialized AI agents — architect, reviewer, security expert, DevOps engineer, and more — each a single Markdown skill file any agent runtime can load into any project. No lock-in. No configuration. Just drop them in.

They have opinions about your PR descriptions. They will not merge your branch if your commit says `fix stuff`. They are not polite about it.

---

## The Oath

> *I commit with intention.*
> *I branch with purpose.*
> *I review with honesty.*
> *I ship with confidence.*
> *I never push to main.*

---

## How it works

Each agent is a single `.md` file that describes a role, its responsibilities, standards, and how it communicates. Load one or all of them into Claude Code, Cursor, or any runtime that supports skill files.

1. **Clone the repo** — get all 14 agent skill files in one command
2. **Load into your runtime** — point Claude Code, Cursor, or your agent framework at the skills directory
3. **Invoke any agent** — ask the Reviewer to check your PR, ask Security to audit your auth flow. They know their role. They have *standards*.

---

## The agents

Every role a real software team needs — available as a skill file with impeccable standards.

| Agent | Role | What it does |
|-------|------|-------------|
| [The Scribe](members/the-scribe/SKILL.md) | Commits, PRs, Changelogs | Conventional Commits enforcement, PR quality checks, changelog generation |
| [The Architect](members/the-architect/SKILL.md) | System Design, ADRs | Spec-first development, task decomposition, architecture decision records |
| [The Reviewer](members/the-reviewer/SKILL.md) | Code Review | Five-axis review (Correctness, Readability, Architecture, Security, Performance) |
| [The Tester](members/the-tester/SKILL.md) | TDD, Coverage | Red-Green-Refactor cycle, test pyramid balancing, regression-first testing |
| [The Debugger](members/the-debugger/SKILL.md) | Error Triage | Read → Reproduce → Hypothesize → Test → Fix protocol, CI diagnosis |
| [The Auditor](members/the-auditor/SKILL.md) | Security | OWASP Top 10 review, dependency audit, secret scanning |
| [The Herald](members/the-herald/SKILL.md) | Releases | Semantic versioning, changelog translation, GitHub Releases |
| [The Librarian](members/the-librarian/SKILL.md) | Documentation | README framework, ADR lifecycle, stale doc detection |
| [The Doorman](members/the-doorman/SKILL.md) | Validation | Commit/PR validation, health checks, branch protection |
| [The Oracle](members/the-oracle/SKILL.md) | Institutional Knowledge | Member authoring templates, naming validation, convention rationale |
| [The Envoy](members/the-envoy/SKILL.md) | Cross-Provider Translation | Provider detection (7 runtimes), skill translation, convention validation |
| [The Sentinel](members/the-sentinel/SKILL.md) | Integrity | Cross-member contradiction detection, structural drift detection |
| [The Warden](members/the-warden/SKILL.md) | Code Health | Code smell detection, cyclomatic complexity enforcement, dead code audit |
| [The Steward](members/the-steward/SKILL.md) | Context Economy | Context budget management, member routing, provider cache strategies |

---

## Getting started

### Option A — Drop into any AI runtime

```bash
npm install --save-dev agenthood
npx agenthood init       # interactive setup (~5 minutes)
npx agenthood check      # verify everything is in place
```

Members are loaded as context by your existing AI assistant. Works with Claude Code, GitHub Copilot, Gemini CLI, OpenAI Codex CLI, and CodeBuddy.

### Option B — Run agents autonomously

Execute members as real LLM agents that reason, act, and remember across sessions. Powered by a TypeScript runtime with Groq as the default free LLM provider.

```bash
npm run build                              # build the runtime (once)
agenthood list                              # see available agents
agenthood run the-scribe "write a commit message for the current diff"
agenthood run the-reviewer "review the changes in the last commit"
agenthood run the-architect "plan the implementation for issue #42"
```

Set `GROQ_API_KEY` in your environment (free at [console.groq.com](https://console.groq.com)), or use Ollama for fully offline execution.

---

## What's shipped

| Version | Milestone | Status |
|---------|-----------|--------|
| v1.0.0 | [Operationally Ready](https://github.com/fworks-tech/agenthood/milestone/1) — consistent APIs, test harness, health checks | ✅ Shipped |
| v1.1.0 | VS Code modernization, Python runtime bootstrap | ✅ Shipped |
| v1.2.0 | VS Code workspace observer event bus | ✅ Shipped |
| v1.4.0 | [The Living Editor](https://github.com/fworks-tech/agenthood/milestone/4) — Doorman SCM validation, Auditor on-save scanning, Reviewer Diagnostics | ✅ Shipped |
| v1.5.0 | [Open Standard](https://github.com/fworks-tech/agenthood/milestone/6) — SKILL.md migration for all 14 members | ✅ Shipped |
| v1.6.x | [The Academy](https://github.com/fworks-tech/agenthood/milestone/12) — Level 1 articles, GitHub Pages, npm via OIDC | ✅ Shipped |
| v2.0.0 | [Foundation](https://github.com/fworks-tech/agenthood/milestone/3) — TypeScript runtime: ILLMProvider, LLMRouter, ReActLoop, BaseAgent | 📋 Planned |
| v2.1.0 | [Intelligence](https://github.com/fworks-tech/agenthood/milestone/7) — 5-tier memory, LanceDB, AgenticRAG, Tree-sitter | 📋 Planned |
| v2.2.0 | [The Full Society](https://github.com/fworks-tech/agenthood/milestone/8) — OracleAgent, DiffImpactAnalyzer, IProtocol | 📋 Planned |

---

## Architecture

The framework runs on five core principles adapted from production AI agent systems. Read the [architecture docs](architecture/README.md) to understand how agents coordinate, prioritize, fail over, and stay safe.

| Principle | Document |
|-----------|---------|
| Multi-agent orchestration & agent roles | [agent-system.md](architecture/agent-system.md) |
| Priority queues & concurrency slots | [concurrency-and-queues.md](architecture/concurrency-and-queues.md) |
| Agent mode vs Ask mode | [operating-modes.md](architecture/operating-modes.md) |
| Multi-LLM support & automatic failover | [provider-failover.md](architecture/provider-failover.md) |
| Tool registry, scoping & safety caps | [built-in-tools.md](architecture/built-in-tools.md) |

Architecture Decision Records in [`docs/adr/`](docs/adr/):

| ADR | Decision |
|-----|---------|
| [ADR-001](docs/adr/ADR-001-markdown-skills-over-code-agents.md) | Markdown-based skills over code-based agents |
| [ADR-002](docs/adr/ADR-002-conventional-commits-standard.md) | Conventional Commits as the commit standard |
| [ADR-003](docs/adr/ADR-003-dual-enforcement-hooks-and-commitlint.md) | Dual enforcement via bash hooks and commitlint |
| [ADR-004](docs/adr/ADR-004-specialized-members-over-general-agent.md) | 14 specialized agents over a general-purpose agent |
| [ADR-005](docs/adr/ADR-005-orchestrator-pattern.md) | Orchestrator pattern over peer-to-peer agent communication |
| [ADR-008](docs/adr/ADR-008-typescript-runtime-over-python.md) | TypeScript-native runtime over Python + DeepAgents |
| [ADR-009](docs/adr/ADR-009-groq-as-default-llm-provider.md) | Groq as the default free LLM provider |
| [ADR-010](docs/adr/ADR-010-lancedb-for-vector-storage.md) | LanceDB for vector storage |

---

## Compatibility

Agenthood is agent-agnostic. Agents work with:

- [Claude Code](https://claude.ai/code) — via `.claude/skills/`
- [GitHub Copilot](https://copilot.github.com) — via `.github/agents/`
- [Gemini CLI](https://github.com/google-gemini/gemini-cli) — via `GEMINI.md` + skills
- [OpenAI Codex CLI](https://github.com/openai/codex) — via `AGENTS.md` + skills
- [CodeBuddy](https://github.com/olasunkanmi-SE/codebuddy) — via `.codebuddy/skills/`

The TypeScript runtime (`agenthood run`) works alongside any of these — it calls agents as real LLM agents independently of which IDE you use.

---

## For this repo

```bash
npm install && npm run build
make setup          # activates git hooks and commit template
npm test            # run all tests
npm run typecheck   # strict TypeScript check
npm run lint        # ESLint
```

---

## Repository structure

```
agenthood/
├── README.md                        ← You are here
├── AGENTS.md                        ← Agent registry (agent-agnostic)
├── oath.md                          ← The oath
│
├── conventions/                     ← Rules every agent follows
│   ├── .gitmessage
│   ├── commitlint.config.cjs
│   └── COMMIT_CONVENTION.md
│
├── members/                         ← 14 agent skill files
│   ├── the-scribe/
│   ├── the-architect/
│   ├── the-reviewer/
│   ├── the-tester/
│   ├── the-debugger/
│   ├── the-auditor/
│   ├── the-herald/
│   ├── the-librarian/
│   ├── the-doorman/
│   ├── the-oracle/
│   ├── the-envoy/
│   ├── the-sentinel/
│   ├── the-warden/
│   └── the-steward/
│
├── rituals/                         ← Scheduled automations
│   ├── morning-briefing.md
│   ├── the-inspection.md
│   ├── the-watchman.md
│   └── evening-report.md
│
├── portals/                         ← External system connectors
│   ├── github.md
│   ├── linear.md
│   ├── jira.md
│   ├── slack.md
│   └── sentry.md
│
├── agentic-workflows/               ← Multi-step workflow templates
│   ├── README.md
│   ├── triage-issues.agent.md
│   ├── review-pr.agent.md
│   ├── diagnose-ci-failure.agent.md
│   └── sync-docs.agent.md
│
├── architecture/                    ← Agent system design docs
│   ├── agent-system.md
│   ├── built-in-tools.md
│   ├── concurrency-and-queues.md
│   ├── operating-modes.md
│   └── provider-failover.md
│
├── docs/adr/                        ← Architecture Decision Records (ADR-001–ADR-010)
│
├── src/                             ← Node.js CLI + TypeScript runtime
│   ├── cli.ts                       ← Entry point
│   ├── commands/                    ← CLI commands (init, check, run, list, …)
│   ├── agents/                      ← BaseAgent + 4 specialized agents
│   ├── llm/                         ← ILLMProvider, LLMRouter, 4 providers
│   ├── skills/                      ← ISkill, SkillRegistry
│   ├── memory/                      ← ShortTerm, LongTerm, Episodic, Project, Residual
│   ├── rag/                         ← Embedder, Retriever, Indexer, AgenticRAG
│   ├── reasoning/                   ← ReActLoop, ThinkingBudget, ChainOfThought
│   ├── workflows/                   ← WorkflowEngine, GoalChain
│   ├── evals/                       ← EvalRunner, EpisodeLearner
│   └── observability/               ← Tracer, TokenCounter, EventBus
│
├── .github/workflows/               ← CI enforcement
│   ├── auto-assign.yml              ← Assigns owner to all new issues and PRs
│   ├── auditor.yml                  ← Secret scanning on push
│   ├── commitlint.yml               ← Validates commit messages on PRs
│   ├── docs.yml                     ← Deploys Academy to GitHub Pages
│   ├── labeler.yml                  ← Labels PRs by changed file paths
│   ├── librarian.yml                ← Checks docs stay in sync with code
│   ├── semantic-release.yml         ← Automated release + npm publish via OIDC
│   ├── sentinel.yml                 ← Agent integrity checks
│   ├── tester.yml                   ← Runs the full test suite
│   ├── vscode-extension.yml         ← Builds the VS Code extension
│   └── warden.yml                   ← File size and code health checks
│
├── .githooks/                       ← Local git hook enforcement
│   ├── commit-msg                   ← Validates commit message format
│   ├── pre-commit                   ← Blocks main commits, scans secrets
│   ├── pre-push                     ← Enforces ticket-first branch naming
│   └── prepare-commit-msg           ← Injects commit message template
│
└── vscode-extension/                ← VS Code extension
    ├── src/
    │   ├── doormanService.ts        ← Real-time SCM input validation
    │   ├── auditorService.ts        ← On-save secret and dep scanning
    │   ├── reviewerService.ts       ← [blocking]/[suggestion] diagnostics
    │   ├── librarianService.ts      ← Stale documentation nudge
    │   └── memberWatchProvider.ts   ← 14-agent live sidebar TreeView
    └── package.json
```

---

## References

- [Conventional Commits](https://www.conventionalcommits.org/)
- [addyosmani/agent-skills](https://github.com/addyosmani/agent-skills)
- [groq-sdk](https://github.com/groq/groq-typescript) — default free LLM provider
- [LanceDB](https://lancedb.github.io/lancedb/) — TypeScript-native vector storage
- [semantic-release](https://github.com/semantic-release/semantic-release)
- [commitlint](https://commitlint.js.org/)

---

*Open source. No sign-up. Works with any agent runtime.*
*Membership is free. Standards are not.*
