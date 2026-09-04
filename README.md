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
| ✍️ | [The Scribe](skills/the-scribe/SKILL.md) | Commits, PRs, changelogs |
| 🏗️ | [The Architect](skills/the-architect/SKILL.md) | System design, ADRs, tech decisions |
| 🛠️ | [The Builder](skills/the-builder/SKILL.md) | Coding, implementation, refactoring, validation |
| 🔍 | [The Reviewer](skills/the-reviewer/SKILL.md) | Code review, standards enforcement |
| 🧪 | [The Tester](skills/the-tester/SKILL.md) | TDD, coverage, edge cases |
| 🐛 | [The Debugger](skills/the-debugger/SKILL.md) | Error triage, root cause analysis |
| 🔒 | [The Auditor](skills/the-auditor/SKILL.md) | Security, vulnerability scanning, dependency audit |
| 📦 | [The Herald](skills/the-herald/SKILL.md) | Releases, versioning, changelogs |
| 📝 | [The Librarian](skills/the-librarian/SKILL.md) | Documentation, API references |
| 🚪 | [The Doorman](skills/the-doorman/SKILL.md) | Validation, branch protection, health checks |
| 🔮 | [The Oracle](skills/the-oracle/SKILL.md) | Institutional knowledge, authoring templates |
| 🌐 | [The Envoy](skills/the-envoy/SKILL.md) | Cross-provider translation, convention validation |
| 👁️ | [The Sentinel](skills/the-sentinel/SKILL.md) | Integrity, cross-member contradiction detection |
| ⚖️ | [The Warden](skills/the-warden/SKILL.md) | Code health, complexity enforcement |
| 🧭 | [The Steward](skills/the-steward/SKILL.md) | Context economy, provider cache strategies |
| 🚦 | [The Mediator](skills/the-mediator/SKILL.md) | First-in-line intent routing, handoff sequencing |
| 🎯 | [The Strategist](skills/the-strategist/SKILL.md) | Goal refinement, requirement discovery |
| 🩺 | [The Operator](skills/the-operator/SKILL.md) | Runtime health, deployments, rollback |
| 👁️ | [The Inspector](skills/the-inspector/SKILL.md) | Visual-reasoning benchmarking, pixel analysis |
| 📬 | [The Mailman](skills/the-mailman/SKILL.md) | Message delivery, scheduling, cross-posting |

---

## Getting started

### Option A — Drop into any AI runtime

```bash
npm install --save-dev agenthood
npx agenthood init       # interactive setup (~1 minute)
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
npx agenthood trace                     # list recent invocation traces
npx agenthood log                       # list recent structured log entries
npx agenthood health                    # runtime health checks (exit 0/1/2)
npx agenthood eval the-reviewer --suite evals/benchmarks/review-pr.json  # scored eval with baseline gating
npx agenthood rollback the-scribe       # restore SKILL.md from lockfile
npx agenthood workflow review-pr        # execute the review-pr workflow
```

#### Structured logging

Log entries are persisted to the same NDJSON store as traces (`.agenthood/traces/traces.ndjson`) and share its retention policy:

```bash
npx agenthood log                      # recent entries (default limit 20)
npx agenthood log --level warn         # filter by debug|info|warn|error
npx agenthood log --member the-scribe --limit 50
npx agenthood log --since 1h --json    # jq-friendly NDJSON output
```

Programmatically, the runtime's `Logger` (in `src/core/Logger.ts`) writes the same entries: `log(level, message, member?)` plus `debug`/`info`/`warn`/`error` helpers. Existing `console.*` calls keep working — `log()` is the recommended replacement, not a breaking migration. Logs also publish `log.created` events on the `RunEventBus` when the logger is wired to one.

Set one of these in a `.env` file in your project root (loaded automatically by the runtime) — and add `.env` to your `.gitignore` so keys never get committed. The default provider follows the `providers` list in `.agenthood/config.json` (opencode primary, Groq among the fallbacks) — set the keys for the providers you want available:

| Variable | Provider | Free tier |
|----------|----------|-----------|
| `OPENCODE_API_KEY` | OpenCode / OpenCodeGo (default) | [opencode.ai](https://opencode.ai) |
| `GROQ_API_KEY` | Groq (fallback) | [console.groq.com](https://console.groq.com) |
| `ANTHROPIC_API_KEY` | Anthropic | — |
| `OPENAI_API_KEY` | OpenAI | — |

Or use Ollama for fully offline execution (no key required).

For a full walkthrough — install, commands, CI pipeline, and next steps — see the [Academy Getting Started guide](docs/academy/getting-started.md).

---

## What's shipped

### Runtime (TypeScript CLI)
See the [CHANGELOG.md](CHANGELOG.md) for the full version history.

### Playground (agenthood-site)
[**Agenthood Studio**](https://agenthood.flabs.tech/studio/playground) — a browser-based chat interface for all 20 Society members. Features configurable provider backend (Anthropic, OpenAI, Groq, Ollama, OpenCode), SSE streaming, turnstile CAPTCHA, session-scoped config persistence, Upstash Redis rate limiting, and structured logging with field-level redaction. [Source](https://github.com/fworks-tech/agenthood-site)

---

## Compatibility

Agenthood is agent-agnostic. The skill files work with:

- [Claude Code](https://claude.ai/code) — via `.claude/skills/`
- [GitHub Copilot](https://github.com/features/copilot) — via `.github/copilot-instructions.md`

The TypeScript runtime (`agenthood run`) supports OpenCode (default, per `.agenthood/config.json`), Groq (free tier at [console.groq.com](https://console.groq.com)), Anthropic, OpenAI, and Ollama for fully offline execution.

The [Agenthood Studio playground](https://agenthood.flabs.tech/studio/playground) exercises the same runtime through a browser UI — every chat request runs through `agenthood/dist/llm` with provider routing, failover, and streaming.

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
| Agent memory tiers | [memory](src/memory/) — ResidualMemory, ShortTermMemory, LongTermMemory, EpisodicMemory, ProjectMemory, DecisionLog, ProvenanceStore, DecisionSearch, GraphSnapshot, MetricsCollector, InMemoryStore, PersonalisationStore, LanceDBStore |
| Decision intelligence & auditability | [decision-intelligence.md](docs/architecture/decision-intelligence.md) — per-run decision records, causal chains (CAUSED/INFLUENCED/PRECEDENT_FOR), tamper-evident provenance (SHA-256 hash chain), precedent search, society-graph snapshots |
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
- [Utility Skills](docs/academy/utility-skills.md) — specialist skills beyond the members
- [Level 1: GenAI & RAG Basics](docs/academy/level-1-genai-rag-basics/) — LLMs, prompt engineering, RAG
- [Level 2: AI Agent Essentials](docs/academy/level-2-agent-essentials/) — memory, planning, multi-agent systems
- [Level 3: Advanced Agent Skills](docs/academy/level-3-advanced-skills/) — integration, performance, deployment

---

## References

- [Conventional Commits](https://www.conventionalcommits.org/)
- [addyosmani/agent-skills](https://github.com/addyosmani/agent-skills)
- [opencode](https://github.com/sst/opencode) — default free LLM provider
- [semantic-release](https://github.com/semantic-release/semantic-release)
- [commitlint](https://commitlint.js.org/)

---

*Open source. No sign-up. Works with any agent runtime.*
*Membership is free. Standards are not.*
