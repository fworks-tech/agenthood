# Agenthood

[![npm version](https://img.shields.io/npm/v/agenthood?style=flat-square&logo=npm)](https://www.npmjs.com/package/agenthood) [![npm downloads](https://img.shields.io/npm/dm/agenthood?style=flat-square&logo=npm)](https://www.npmjs.com/package/agenthood) [![License: MIT](https://img.shields.io/badge/License-MIT-blue?style=flat-square)](LICENSE) [![Node.js](https://img.shields.io/badge/node-%3E%3D22.14.0-brightgreen?style=flat-square&logo=node.js)](https://nodejs.org) [![skills.sh](https://skills.sh/b/fworks-tech/agenthood)](https://skills.sh/fworks-tech/agenthood)

> A full AI engineering team as plain Markdown files.

Specialized AI agents — architect, reviewer, security expert, DevOps engineer, strategist, operator, and more — each a single Markdown skill file any agent runtime can load into any project. No lock-in. No configuration. Just drop them in.

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
| ✍️ | [The Scribe](docs/members/the-scribe/SKILL.md) | Commits, PRs, changelogs |
| 🏗️ | [The Architect](docs/members/the-architect/SKILL.md) | System design, ADRs, tech decisions |
| 🔍 | [The Reviewer](docs/members/the-reviewer/SKILL.md) | Code review, standards enforcement |
| 🧪 | [The Tester](docs/members/the-tester/SKILL.md) | TDD, coverage, edge cases |
| 🐛 | [The Debugger](docs/members/the-debugger/SKILL.md) | Error triage, root cause analysis |
| 🔒 | [The Auditor](docs/members/the-auditor/SKILL.md) | Security, vulnerability scanning, dependency audit |
| 📦 | [The Herald](docs/members/the-herald/SKILL.md) | Releases, versioning, changelogs |
| 📝 | [The Librarian](docs/members/the-librarian/SKILL.md) | Documentation, API references |
| 🚪 | [The Doorman](docs/members/the-doorman/SKILL.md) | Validation, branch protection, health checks |
| 🔮 | [The Oracle](docs/members/the-oracle/SKILL.md) | Institutional knowledge, authoring templates |
| 🌐 | [The Envoy](docs/members/the-envoy/SKILL.md) | Cross-provider translation, convention validation |
| 👁️ | [The Sentinel](docs/members/the-sentinel/SKILL.md) | Integrity, cross-member contradiction detection |
| ⚖️ | [The Warden](docs/members/the-warden/SKILL.md) | Code health, complexity enforcement |
| 🧭 | [The Steward](docs/members/the-steward/SKILL.md) | Context economy, provider cache strategies |
| 🎯 | [The Strategist](docs/members/the-strategist/SKILL.md) | Goal refinement, requirement discovery |
| 🩺 | [The Operator](docs/members/the-operator/SKILL.md) | Runtime health, deployments, rollback |

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
npx agenthood verify                    # validate member SKILL.md integrity
npx agenthood status --watch            # live project health monitoring
npx agenthood rollback the-scribe       # restore SKILL.md from lockfile
npx agenthood workflow review-pr        # execute the review-pr workflow
```

Set one of these in a `.env` file in your project root (loaded automatically by the runtime):

| Variable | Provider | Free tier |
|----------|----------|-----------|
| `GROQ_API_KEY` | Groq (default) | [console.groq.com](https://console.groq.com) |
| `ANTHROPIC_API_KEY` | Anthropic | — |
| `OPENAI_API_KEY` | OpenAI | — |
| `OPENCODE_API_KEY` | OpenCode / OpenCodeGo | [opencode.ai](https://opencode.ai) |

Or use Ollama for fully offline execution (no key required).

For a full walkthrough — install, commands, CI pipeline, and next steps — see the [Academy Getting Started guide](docs/academy/getting-started.md).

---

## What's shipped

See the [CHANGELOG.md](CHANGELOG.md) for the full version history.

---

## Compatibility

Agenthood is agent-agnostic. The skill files work with:

- [Claude Code](https://claude.ai/code) — via `.claude/skills/`
- [GitHub Copilot](https://github.com/features/copilot) — via `.github/copilot-instructions.md`

The TypeScript runtime (`agenthood run`) supports Groq (default, free tier at [console.groq.com](https://console.groq.com)), Anthropic, OpenAI, OpenCode, and Ollama for fully offline execution.

---

## Architecture

The framework runs on five core principles adapted from production AI agent systems. See the [architecture docs](docs/architecture/README.md) for details on how agents coordinate, prioritize, fail over, and stay safe.

| Principle | Document |
|-----------|---------|
| Multi-agent orchestration & agent roles | [agent-system.md](docs/architecture/agent-system.md) |
| Priority queues & concurrency slots | [concurrency-and-queues.md](docs/architecture/concurrency-and-queues.md) |
| Agent mode vs Ask mode | [operating-modes.md](docs/architecture/operating-modes.md) |
| Multi-LLM support & automatic failover | [provider-failover.md](docs/architecture/provider-failover.md) |
| Tool registry, scoping & safety caps | [built-in-tools.md](docs/architecture/built-in-tools.md) |
| Agent memory tiers | [memory](src/memory/) — ResidualMemory, ShortTermMemory, LongTermMemory, EpisodicMemory, ProjectMemory, DecisionLog, MetricsCollector, InMemoryStore, PersonalisationStore, LanceDBStore |
| Workflow engine & quality gates | [workflows](src/workflows/) — WorkflowEngine, QualityGates, DiffImpactAnalyzer, WorkflowCheckpoint, GoalChain |
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

See [STRUCTURE.md](STRUCTURE.md) for the full directory tree.

---

## Academy

Structured learning path from "what is a prompt?" to "ship agents to production."

- [Getting Started](docs/academy/getting-started.md) — install, first commit, CI, configuration
- [Skills Reference](docs/academy/skills-reference.md) — all members, their tools, and invocation
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
