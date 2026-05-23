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

---

## The Layers

The Agenthood is organized in six layers, each building on the last:

```
Layer 1 — Conventions       The rules every member follows
Layer 2 — Members           The agent skills
Layer 3 — Rituals           Scheduled automations
Layer 4 — Intelligence      Connectors to external systems
Layer 5 — Agentic Workflows GitHub Agentic Workflows (gh aw)
Layer 6 — CI Workflows      Reusable GitHub Actions
```

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

---

## Compatibility

The Agenthood is agent-agnostic. Members work with:

- [Claude Code](https://claude.ai/code) — via `.claude/skills/`
- [GitHub Copilot](https://copilot.github.com) — via `.github/agents/`
- [Gemini CLI](https://github.com/google-gemini/gemini-cli) — via `GEMINI.md` + skills
- [OpenAI Codex CLI](https://github.com/openai/codex) — via `AGENTS.md` + skills
- [CodeBuddy](https://github.com/olasunkanmi-SE/codebuddy) — via `.codebuddy/skills/`

---

## Getting Started

```bash
# 1. Clone the Society
git clone https://github.com/fworks-tech/agenthood.git

# 2. Copy conventions into your project
cp agenthood/conventions/.gitmessage yourproject/
cp agenthood/conventions/commitlint.config.js yourproject/
git config commit.template .gitmessage

# 3. Load the members into your agent runtime
# For Claude Code:
cp -r agenthood/members/ yourproject/.claude/skills/

# 4. Read the oath. Mean it.
cat agenthood/oath.md

# 5. Never push to main again.
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
│   ├── commitlint.config.js
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
│   └── the-doorman/
│
├── rituals/                         ← Layer 3: Automations
│   ├── morning-briefing.md
│   ├── the-inspection.md
│   ├── the-watchman.md
│   └── evening-report.md
│
├── intelligence/                    ← Layer 4: Connectors
│   ├── github.md
│   ├── linear.md
│   ├── jira.md
│   ├── slack.md
│   └── sentry.md
│
├── agentic-workflows/               ← Layer 5: gh aw Markdown workflows
│   ├── triage-issues.agent.md
│   ├── review-pr.agent.md
│   ├── diagnose-ci-failure.agent.md
│   └── sync-docs.agent.md
│
└── workflows/                       ← Layer 6: Reusable GitHub Actions
    ├── commitlint.yml
    ├── pr-title.yml
    └── semantic-release.yml
```

---

## Inspiration & References

- [Conventional Commits](https://www.conventionalcommits.org/)
- [addyosmani/agent-skills](https://github.com/addyosmani/agent-skills)
- [CodeBuddy](https://github.com/olasunkanmi-SE/codebuddy)
- [GitHub Agentic Workflows](https://github.github.com/gh-aw/)
- [semantic-release](https://github.com/semantic-release/semantic-release)
- [commitlint](https://commitlint.js.org/)

---

*The Society is open to all who take the oath seriously.*
*Membership is free. Standards are not.*
