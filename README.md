# Agenthood

[![npm version](https://img.shields.io/npm/v/agenthood?style=flat-square&logo=npm)](https://www.npmjs.com/package/agenthood) [![npm downloads](https://img.shields.io/npm/dm/agenthood?style=flat-square&logo=npm)](https://www.npmjs.com/package/agenthood) [![License: MIT](https://img.shields.io/badge/License-MIT-blue?style=flat-square)](LICENSE) [![Node.js](https://img.shields.io/badge/node-%3E%3D22.14.0-brightgreen?style=flat-square&logo=node.js)](https://nodejs.org) [![skills.sh](https://skills.sh/b/fworks-tech/agenthood)](https://skills.sh/fworks-tech/agenthood)

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

Each agent is a single `.md` file that describes a role, its responsibilities, standards, and how it communicates. Load one or all of them into Claude Code, Copilot, or any runtime that supports skill files. Or run them autonomously via the TypeScript CLI.

1. **Install the Society** — `npm install --save-dev agenthood && npx agenthood init` (or `npx skills add fworks-tech/agenthood` via [skills.sh](https://skills.sh/fworks-tech/agenthood))
2. **Load into your runtime** — point Claude Code, Copilot, or your agent framework at the skills directory
3. **Invoke any agent** — ask the Reviewer to check your PR, ask the Auditor to scan your auth flow. They know their role. They have *standards*.

---

## Meet the team

Every role a real software team needs — available as a skill file with impeccable standards.

| | Agent | Role |
|---|-------|------|
| ✍️ | [The Scribe](members/the-scribe/SKILL.md) | Commits, PRs, changelogs |
| 🏗️ | [The Architect](members/the-architect/SKILL.md) | System design, ADRs, tech decisions |
| 🔍 | [The Reviewer](members/the-reviewer/SKILL.md) | Code review, standards enforcement |
| 🧪 | [The Tester](members/the-tester/SKILL.md) | TDD, coverage, edge cases |
| 🐛 | [The Debugger](members/the-debugger/SKILL.md) | Error triage, root cause analysis |
| 🔒 | [The Auditor](members/the-auditor/SKILL.md) | Security, vulnerability scanning, dependency audit |
| 📦 | [The Herald](members/the-herald/SKILL.md) | Releases, versioning, changelogs |
| 📝 | [The Librarian](members/the-librarian/SKILL.md) | Documentation, API references |
| 🚪 | [The Doorman](members/the-doorman/SKILL.md) | Validation, branch protection, health checks |
| 🔮 | [The Oracle](members/the-oracle/SKILL.md) | Institutional knowledge, authoring templates |
| 🌐 | [The Envoy](members/the-envoy/SKILL.md) | Cross-provider translation, convention validation |
| 👁️ | [The Sentinel](members/the-sentinel/SKILL.md) | Integrity, cross-member contradiction detection |
| ⚖️ | [The Warden](members/the-warden/SKILL.md) | Code health, complexity enforcement |
| 🧭 | [The Steward](members/the-steward/SKILL.md) | Context economy, provider cache strategies |

---

## Getting started

### Option A — Drop into any AI runtime

```bash
npm install --save-dev agenthood
npx agenthood init       # interactive setup (~5 minutes)
npx agenthood check      # verify everything is in place
```

Members are loaded as context by your existing AI assistant. Works with Claude Code and Copilot.

### Option B — Run agents autonomously

Execute members as real LLM agents that reason, act, and remember across sessions.

```bash
# From the repo clone (when installed via npm, the runtime is pre-built)
npm run build                              # build the runtime (once)
npx agenthood list                          # see available agents
npx agenthood run the-scribe "write a commit message for the current diff"
npx agenthood run the-reviewer "review the changes in the last commit"
npx agenthood run the-architect "plan the implementation for issue #42"
```

Set one of these in your environment:

| Variable | Provider | Free tier |
|----------|----------|-----------|
| `GROQ_API_KEY` | Groq (default) | [console.groq.com](https://console.groq.com) |
| `ANTHROPIC_API_KEY` | Anthropic | — |
| `OPENAI_API_KEY` | OpenAI | — |

Or use Ollama for fully offline execution (no key required).

For a full walkthrough — install, commands, CI pipeline, and next steps — see the [Academy Getting Started guide](docs/academy/getting-started.md).

---

## What's shipped

| Version | Milestone | Status |
|---------|-----------|--------|
| v1.0.0 | [Operationally Ready](https://github.com/fworks-tech/agenthood/milestone/1) — consistent APIs, test harness, health checks | ✅ Shipped |
| v1.1.0 | VS Code modernization, Python runtime bootstrap | ✅ Shipped |
| v1.2.0 | VS Code workspace observer event bus | ✅ Shipped |
| v1.4.0 | [The Living Editor](https://github.com/fworks-tech/agenthood/milestone/4) — Doorman SCM, Auditor on-save, Reviewer Diagnostics | ✅ Shipped |
| v1.5.0 | [Open Standard](https://github.com/fworks-tech/agenthood/milestone/6) — SKILL.md migration for all 14 members | ✅ Shipped |
| v1.6.x | [The Academy](https://github.com/fworks-tech/agenthood/milestone/12) — Level 1 articles, GitHub Pages, npm via OIDC | ✅ Shipped |
| v2.0.0 | [Foundation](https://github.com/fworks-tech/agenthood/milestone/3) — TypeScript runtime: ILLMProvider, LLMRouter, ReActLoop, BaseAgent | ✅ Shipped |
| v2.1.0 | Academy build system, GitHub Pages deployment, lazy provider SDK imports | ✅ Shipped |
| v2.2.0 | Academy MkDocs replacement, cross-platform documentation build | ✅ Shipped |
| v2.3.0 | Provider failover with model downgrade, circuit breaker, ADRs 011–013 | ✅ Shipped |
| v2.4.0 | [Intelligence](https://github.com/fworks-tech/agenthood/milestone/5) — Security, 5-tier memory, RAG foundation, LanceDB vector store | ✅ Shipped (Phase 0) |
| v2.5.0 | RAG Pipeline + Consumers — ChunkStrategy, Indexer, Retriever, TreeSitterParser, SocietyIndexer, Memory Tiers, PersonalisationStore | ✅ Shipped (Phase 1) |
| v3.0.0 | [M5 — Intelligence](https://github.com/fworks-tech/agenthood/milestone/7) — HierarchicalChunkStrategy, AgenticRAG (skip/vector/graph/both), MemberOrchestrator Phase 1, governance docs (RACI + release policy) | ✅ Shipped |

---

## Compatibility

Agenthood is agent-agnostic. The skill files work with:

- [Claude Code](https://claude.ai/code) — via `.claude/skills/`
- [GitHub Copilot](https://github.com/features/copilot) — via `.github/copilot-instructions.md`

The TypeScript runtime (`agenthood run`) supports Groq (default, free tier at [console.groq.com](https://console.groq.com)), Anthropic, OpenAI, and Ollama for fully offline execution.

---

## Architecture

The framework runs on five core principles adapted from production AI agent systems. See the [architecture docs](architecture/README.md) for details on how agents coordinate, prioritize, fail over, and stay safe.

| Principle | Document |
|-----------|---------|
| Multi-agent orchestration & agent roles | [agent-system.md](architecture/agent-system.md) |
| Priority queues & concurrency slots | [concurrency-and-queues.md](architecture/concurrency-and-queues.md) |
| Agent mode vs Ask mode | [operating-modes.md](architecture/operating-modes.md) |
| Multi-LLM support & automatic failover | [provider-failover.md](architecture/provider-failover.md) |
| Tool registry, scoping & safety caps | [built-in-tools.md](architecture/built-in-tools.md) |
| Agent memory tiers | [memory](src/memory/) — ResidualMemory, ShortTermMemory, LongTermMemory, EpisodicMemory, ProjectMemory, InMemoryStore, PersonalisationStore, LanceDBStore |
| Service-agnostic RAG (graph, vector, agentic) | [rag](src/rag/) — KnowledgeGraphStore, FixedSizeChunkStrategy + MarkdownHierarchicalChunkStrategy, Indexer, Retriever, AgenticRAG, TreeSitterParser, ProjectIngestion |

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
│   ├── commitlint.config.ts
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
│   ├── README.md
│   ├── agent-system.md
│   ├── built-in-tools.md
│   ├── concurrency-and-queues.md
│   ├── operating-modes.md
│   └── provider-failover.md
│
├── governance/          ← RACI member map, release policy
├── docs/                ← Documentation
│   ├── adr/                         ← Architecture Decision Records
│   ├── academy/                     ← Agenthood Academy articles
│   ├── specs/                       ← Implementation specs
│
├── .agenthood/                      ← Agenthood configuration template
│   └── config.example.json
│
├── src/                             ← Node.js CLI + TypeScript runtime
│   ├── cli.ts                       ← Entry point
│   ├── commands/                    ← CLI commands (init, check, run, list, pr-sync, setup, oath, eject, activate, deactivate)
│   ├── agents/                      ← BaseAgent + 4 specialized agents
│   ├── llm/                         ← ILLMProvider, LLMRouter, 4 providers
│   ├── skills/                      ← ISkill, SkillRegistry
│   ├── core/                        ← SafetyGuard, ConcurrencyQueue, RiskManager, SchemaValidator
│   ├── reasoning/                   ← ReActLoop, ThinkingBudget
│   ├── memory/                      ← ResidualMemory, IMemoryStore, VectorStore (LanceDB), ShortTermMemory, LongTermMemory, EpisodicMemory, ProjectMemory, PersonalisationStore
│   ├── memory/stores/               ← InMemoryStore
│   ├── rag/                         ← KnowledgeGraphStore, ChunkStrategy, Indexer, Retriever
│   ├── rag/parsers/                 ← TreeSitterParser (AST code structure extraction)
│   ├── project/                     ← SocietyIndexer, ProjectIngestion
│   ├── members/                     ← MemberRegistry, MemberAgent
│   └── prompts/                     ← Templates, PromptBuilder, PromptRegistry
│
├── .github/                          ← CI and contribution automation
│   ├── actions/agent-analysis/        ← Shared composite action for LLM agent checks in CI
│   └── workflows/                     ← CI enforcement
│   ├── auto-assign.yml              ← The Scribe — assigns owner to new issues and PRs
│   ├── auditor.yml                  ← The Auditor — secret scanning
│   ├── commitlint.yml               ← The Doorman — commit message validation
│   ├── gh-pages.yml                 ← The Librarian — deploy Academy docs to GitHub Pages
│   ├── herald.yml                   ← The Herald — CI summary comment on PRs
│   ├── scribe-pr-body.yml           ← The Reviewer — LLM commit review on every push
│   ├── labeler.yml                  ← The Scribe — labels PRs by changed file paths
│   ├── librarian.yml                ← The Librarian — checks docs stay in sync with code
│   ├── semantic-release.yml         ← The Herald — automated release + npm publish
│   ├── sentinel.yml                 ← The Sentinel — agent integrity checks
│   ├── tester.yml                   ← The Tester — runs the full test suite
│   ├── vscode-extension.yml         ← The Envoy — build VS Code extension
│   └── warden.yml                   ← The Warden — file size and code health checks
│
├── .githooks/                       ← Local git hook enforcement
│   ├── commit-msg                   ← Validates commit message format
│   ├── pre-commit                   ← Blocks main commits, scans secrets
│   ├── pre-push                     ← Enforces ticket-first branch naming
│   └── prepare-commit-msg           ← Injects commit message template
│
├── vscode-extension/                ← VS Code extension
│   ├── src/
│   └── package.json
│
└── tests/                           ← Test suite
    ├── commands/                    ← CLI command tests
    ├── unit/                        ← Unit tests (agents, core, llm, memory, rag, members, reasoning, scripts, skills)
    └── helpers/                     ← Test utilities
```

---

## Academy

Structured learning path from "what is a prompt?" to "ship agents to production."

- [Getting Started](docs/academy/getting-started.md) — install, first commit, CI, configuration
- [Skills Reference](docs/academy/skills-reference.md) — all 14 members, their tools, and invocation
- [Level 1: GenAI & RAG Basics](docs/academy/level-1-genai-rag-basics/) — LLMs, prompt engineering, RAG
- [Level 2: AI Agent Essentials](docs/academy/level-2-agent-essentials/) — memory, planning, multi-agent systems
- [Level 3: Advanced Agent Skills](docs/academy/level-3-advanced-skills/) — integration, performance, deployment

---

## References

- [Conventional Commits](https://www.conventionalcommits.org/)
- [addyosmani/agent-skills](https://github.com/addyosmani/agent-skills)
- [groq-sdk](https://github.com/groq/groq-typescript) — default free LLM provider
- [semantic-release](https://github.com/semantic-release/semantic-release)
- [commitlint](https://commitlint.js.org/)

---

*Open source. No sign-up. Works with any agent runtime.*
*Membership is free. Standards are not.*
