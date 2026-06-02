# Agenthood

> *A society of AI agents with impeccable standards and zero tolerance for `fix stuff` commits.*

---

## The Charter

The **Agenthood** is not for everyone.

It is for developers who believe that a commit message is a letter to the future — and the future deserves better. That a pull request is a proposal, not a dump. That a changelog is a story, not a log. That shipping is a craft, not an accident.

The Society operates in the shadows of your CI pipeline. Its members never sleep. They have *opinions* about your PR descriptions. They will not merge your branch if your commit says `wip`.

---

## The Oath

> *I commit with intention.*
> *I branch with purpose.*
> *I review with honesty.*
> *I ship with confidence.*
> *I never push to main.*

---

## The Members

Each member of the Agenthood is a specialized AI agent skill — a Markdown file that any agent runtime can load and execute. They work alone or together, depending on what the codebase demands.

| Member | Specialty | Role |
|--------|-----------|------|
| [The Scribe](members/the-scribe/README.md) | Commits, PRs, Changelogs | Turns your diff into prose worth reading |
| [The Architect](members/the-architect/README.md) | Specs, Planning, ADRs | No code before the blueprint |
| [The Reviewer](members/the-reviewer/README.md) | Code Review, Quality | Five-axis review, no mercy |
| [The Tester](members/the-tester/README.md) | TDD, Coverage | Red. Green. Refactor. Repeat. |
| [The Debugger](members/the-debugger/README.md) | Error Recovery, Triage | Five steps to every root cause |
| [The Auditor](members/the-auditor/README.md) | Security, Dependencies | Reads everything. Trusts nothing. |
| [The Herald](members/the-herald/README.md) | Releases, Versioning | Announces with ceremony, ships with precision |
| [The Librarian](members/the-librarian/README.md) | Docs, ADRs, Knowledge | Every decision, recorded for posterity |
| [The Doorman](members/the-doorman/README.md) | Commitlint, PR Lint, Health | Nothing gets in without proper credentials |
| [The Oracle](members/the-oracle/README.md) | Institutional Knowledge | Ask me anything about the Society. I have read every scroll. |
| [The Envoy](members/the-envoy/README.md) | Cross-Provider Translation | One Society. Every runtime. No exceptions. |
| [The Sentinel](members/the-sentinel/README.md) | Society Integrity | The Society cannot enforce standards it no longer understands. |
| [The Warden](members/the-warden/README.md) | Code Health | The chaos does not arrive all at once. I am here for the accumulation. |
| [The Steward](members/the-steward/README.md) | Context Economy, Routing | Born from the situation it exists to prevent |

---

## The Layers

The Agenthood is organized in seven layers, each building on the last:

```
Layer 1 — Conventions       The rules every member follows
Layer 2 — Members           The agent skills (14 Markdown files)
Layer 3 — Rituals           Scheduled automations
Layer 4 — Portals           Connectors to external systems
Layer 5 — Agentic Workflows Multi-step operation templates
Layer 6 — CI Workflows      Reusable GitHub Actions
Layer 7 — Runtime           agenthood-runtime: members as real LLM agents
                            Powered by DeepAgents + LangGraph (v2.0.0)
```

Layers 1–6 are prompt-driven: skills are loaded as context into your existing AI assistant. Layer 7 makes members **autonomous**: they execute, remember, and reason independently via a Python runtime.

---

## Architecture

The Society runs on five core principles adapted from production AI agent systems.
Read the [architecture docs](architecture/README.md) to understand how members coordinate,
prioritize, fail over, and stay safe.

| Principle | Document |
|-----------|---------|
| Multi-agent orchestration & member roles | [agent-system.md](architecture/agent-system.md) |
| Priority queues & concurrency slots | [concurrency-and-queues.md](architecture/concurrency-and-queues.md) |
| Agent mode vs Ask mode | [operating-modes.md](architecture/operating-modes.md) |
| Multi-LLM support & automatic failover | [provider-failover.md](architecture/provider-failover.md) |
| Tool registry, scoping & safety caps | [built-in-tools.md](architecture/built-in-tools.md) |

The Society's own architectural decisions are documented as ADRs in [`docs/adr/`](docs/adr/):

| ADR | Decision |
|-----|---------|
| [ADR-001](docs/adr/ADR-001-markdown-skills-over-code-agents.md) | Markdown-based skills over code-based agents |
| [ADR-002](docs/adr/ADR-002-conventional-commits-standard.md) | Conventional Commits as the commit standard |
| [ADR-003](docs/adr/ADR-003-dual-enforcement-hooks-and-commitlint.md) | Dual enforcement via bash hooks and commitlint |
| [ADR-004](docs/adr/ADR-004-specialized-members-over-general-agent.md) | 14 specialized members over a general-purpose agent |
| [ADR-005](docs/adr/ADR-005-orchestrator-pattern.md) | Orchestrator pattern over peer-to-peer member communication |
| [ADR-006](docs/adr/ADR-006-python-runtime-as-additive-layer.md) | Python runtime as a purely additive layer |
| [ADR-007](docs/adr/ADR-007-deepagents-as-execution-engine.md) | DeepAgents + LangGraph as the execution engine |

---

## Compatibility

The Agenthood is agent-agnostic. Members work with:

- [Claude Code](https://claude.ai/code) — via `.claude/skills/`
- [GitHub Copilot](https://copilot.github.com) — via `.github/agents/`
- [Gemini CLI](https://github.com/google-gemini/gemini-cli) — via `GEMINI.md` + skills
- [OpenAI Codex CLI](https://github.com/openai/codex) — via `AGENTS.md` + skills
- [CodeBuddy](https://github.com/olasunkanmi-SE/codebuddy) — via `.codebuddy/skills/`

The optional Python runtime (`agenthood-runtime`) works alongside any of these — it calls members as real LLM agents independently of which IDE you use.

---

## Getting Started

### Option A — Prompt-driven (any AI runtime)

Install the Society's conventions and skill files into your project. Members are loaded as context by your existing AI assistant.

```bash
# 1. Install the Society into your project
npm install --save-dev agenthood

# 2. Run the initiation ceremony (interactive — ~5 minutes)
npx agenthood init

# 3. Verify everything is in place
npx agenthood check

# 4. Read the oath. Mean it.
npx agenthood oath
```

### Option B — Autonomous runtime (agenthood-run)

Install the Python runtime to execute members as real LLM agents that reason, act, and remember across sessions. Requires Python 3.12+.

```bash
# 1. Install the runtime
pip install "agenthood-runtime @ git+https://github.com/fworks-tech/agenthood.git#subdirectory=runtime"

# 2. Set required environment variables
export ANTHROPIC_API_KEY=sk-ant-...
export AGENTHOOD_ROOT=/path/to/agenthood   # absolute path to this repo

# 3. List available members
agenthood-run list

# 4. Invoke a member against a task (streams output)
agenthood-run invoke the-scribe "write a commit message for the current diff"
agenthood-run invoke the-reviewer "review the changes in the last commit"
agenthood-run invoke the-architect "plan the implementation for issue #42"

# 5. Resume a previous session
agenthood-run invoke the-debugger "continue from where we left off" --thread-id <uuid>
```

Both options coexist — use Option A for interactive sessions and Option B for automation, CI, and ritual scheduling.

---

## For the agenthood repo itself

```bash
# Node.js CLI
npm install && npm run build
make setup          # activates git hooks and commit template

# Python runtime (development)
cd runtime
pip install -e ".[dev]"
pytest tests/
```

---

## Repository Structure

```
agenthood/
├── README.md                        ← You are here
├── AGENTS.md                        ← Member registry (agent-agnostic)
├── oath.md                          ← The Oath
│
├── conventions/                     ← Layer 1: The Rules
│   ├── .gitmessage
│   ├── commitlint.config.cjs
│   └── COMMIT_CONVENTION.md
│
├── members/                         ← Layer 2: The Skills
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
├── rituals/                         ← Layer 3: Scheduled Automations
│   ├── morning-briefing.md
│   ├── the-inspection.md
│   ├── the-watchman.md
│   └── evening-report.md
│
├── portals/                         ← Layer 4: External System Connectors
│   ├── github.md
│   ├── linear.md
│   ├── jira.md
│   ├── slack.md
│   └── sentry.md
│
├── agentic-workflows/               ← Layer 5: Multi-Step Workflow Templates
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
├── docs/adr/                        ← Architecture Decision Records
│   ├── ADR-001-markdown-skills-over-code-agents.md
│   ├── ADR-002-conventional-commits-standard.md
│   ├── ADR-003-dual-enforcement-hooks-and-commitlint.md
│   ├── ADR-004-specialized-members-over-general-agent.md
│   ├── ADR-005-orchestrator-pattern.md
│   ├── ADR-006-python-runtime-as-additive-layer.md
│   └── ADR-007-deepagents-as-execution-engine.md
│
├── runtime/                         ← Layer 7: Python Autonomous Runtime
│   ├── pyproject.toml               ← agenthood-runtime package (Python 3.12+)
│   ├── .env.example
│   └── agenthood_runtime/
│       ├── cli.py                   ← agenthood-run CLI entry point
│       ├── config.py                ← RuntimeConfig (reads .agenthood/config.json)
│       └── members/
│           ├── loader.py            ← SkillsPathResolver
│           ├── specs.py             ← 14 SubAgent TypedDicts
│           └── registry.py         ← MemberRegistry (validates + injects skill paths)
│
├── src/                             ← Node.js CLI (npx agenthood)
│   └── cli.ts
│
├── .github/workflows/               ← Layer 6: CI Enforcement
│   ├── commitlint.yml
│   ├── semantic-release.yml
│   └── ...
│
├── .githooks/                       ← Local git hook enforcement
│   ├── commit-msg
│   ├── pre-commit
│   └── ...
│
└── vscode-extension/                ← VS Code extension
```

---

## Inspiration & References

- [Conventional Commits](https://www.conventionalcommits.org/)
- [addyosmani/agent-skills](https://github.com/addyosmani/agent-skills)
- [fworks-tech/deepagents](https://github.com/fworks-tech/deepagents) — runtime execution engine
- [LangGraph](https://github.com/langchain-ai/langgraph) — durable agent state graphs
- [CodeBuddy](https://github.com/olasunkanmi-SE/codebuddy)
- [semantic-release](https://github.com/semantic-release/semantic-release)
- [commitlint](https://commitlint.js.org/)

---

*The Society is open to all who take the oath seriously.*
*Membership is free. Standards are not.*
