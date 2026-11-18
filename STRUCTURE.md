```
agenthood/
├── README.md                        ← Project overview
├── STRUCTURE.md                     ← This file
├── AGENTS.md                        ← Agent registry (agent-agnostic)
├── CONTRIBUTING.md                  ← Repo workflow: setup, tests, commits, PRs
├── CONTRIBUTING-skills.md           ← Skill authoring checklist
├── MIGRATION.md                     ← Upgrade and rollback notes
├── oath.md                          ← The oath
│
├── docs/
│   ├── conventions/                 ← Rules every agent follows
│   │   ├── .gitmessage
│   │   ├── commitlint.config.ts
│   │   └── COMMIT_CONVENTION.md
│   ├── members/                     ← Member identity cards (the-*) + registry.json
│   │   the-architect, the-auditor, the-builder, the-debugger, the-doorman,
│   │   the-envoy, the-herald, the-inspector, the-librarian, the-mailman,
│   │   the-mediator, the-operator, the-oracle, the-reviewer, the-scribe,
│   │   the-sentinel, the-steward, the-strategist, the-tester, the-warden
│   ├── rituals/                     ← Scheduled automations
│   │   ├── morning-briefing.md
│   │   ├── inspection.md
│   │   ├── watchman.md
│   │   └── evening-report.md
│   ├── portals/                     ← External system connectors
│   │   ├── README.md
│   │   ├── github.md
│   │   ├── linear.md
│   │   ├── jira.md
│   │   ├── slack.md
│   │   └── sentry.md
│   ├── agentic-workflows/           ← Multi-step workflow templates
│   │   ├── README.md
│   │   ├── triage-issues.agent.md
│   │   ├── review-pr.agent.md
│   │   ├── diagnose-ci-failure.agent.md
│   │   ├── sentry-opencode-debugging.agent.md
│   │   ├── sync-docs.agent.md
│   │   └── deepagents-patterns.md
│   ├── architecture/                ← Agent system design docs
│   │   ├── README.md
│   │   ├── agent-system.md
│   │   ├── built-in-tools.md
│   │   ├── chain-workflows.md
│   │   ├── concurrency-and-queues.md
│   │   ├── decision-intelligence.md
│   │   ├── operating-modes.md
│   │   ├── provider-failover.md
│   │   └── skills.md
│   ├── governance/                  ← RACI member map, release policy
│   ├── guides/                      ← Provider, member, skill and troubleshooting guides
│   ├── adr/                         ← Architecture Decision Records
│   ├── academy/                     ← Agenthood Academy articles
│   ├── specs/                       ← Implementation specs
│   ├── templates/                   ← Reusable document templates
│   └── api/                         ← Generated TSDoc API reference (gitignored)
│
├── .agenthood/                      ← Agenthood configuration template
│   └── config.example.json
│
├── skills/                          ← Canonical skill files (skills/<name>/SKILL.md)
│   ├── _shared/                     ← Content shared between skills
│   └── <member>/                    ← One directory per member and utility skill
│
├── src/                             ← Node.js CLI + TypeScript runtime
│   ├── cli.ts                       ← Entry point
│   ├── commands/                    ← One file per CLI command (see CONTRIBUTING.md)
│   ├── agents/                      ← BaseAgent + AgentRegistry
│   ├── checkpoint/                  ← Run checkpoints
│   ├── core/                        ← SafetyGuard, queues, schemas, traces, logging
│   ├── evals/                       ← Evaluation runner and scoring
│   ├── init/                        ← Project scaffolding
│   ├── llm/                         ← Providers, router, multimodal support
│   ├── mcp/                         ← MCP server
│   ├── members/                     ← MemberRegistry, MemberAgent
│   ├── memory/                      ← Decision log, provenance, memory tiers, vector store
│   ├── metrics/                     ← Cost and usage metrics
│   ├── project/                     ← SocietyIndexer, ProjectIngestion
│   ├── prompts/                     ← Prompt templates and builder
│   ├── rag/                         ← Knowledge graph, chunking, indexer, retriever
│   ├── reasoning/                   ← ReActLoop, ThinkingBudget
│   ├── runtime/                     ← Run orchestration
│   ├── skills/                      ← Discovery, gating, execution, manifests
│   ├── tools/                       ← Built-in tool implementations
│   ├── utils/                       ← Shared helpers, lockfile, path guard
│   └── workflows/                   ← WorkflowEngine, chains, quality gates, checkpoints
│
├── .github/                          ← CI and contribution automation
│   ├── actions/agent-analysis/        ← Shared composite action for LLM agent checks in CI
│   ├── actions/setup-env/             ← Shared composite action: Node + npm ci
│   ├── scripts/                       ← Locally-run CI check scripts (PR body, docs, members)
│   └── workflows/                     ← CI enforcement
│       ├── distribution.yml           ← The Envoy: Skills.sh, SkillsMP, traction badges
│       ├── herald.yml                 ← The Herald: CI summary comment on PRs
│       ├── opencode-catalog-sync.yml  ← Weekly refresh of the OpenCode model catalog
│       ├── pr.yml                     ← Doorman, Auditor, Scribe, Warden, Librarian, Sentinel, Tester
│       ├── publish-vsce.yml           ← The Envoy: publish VSIX to Marketplace
│       ├── reviewer.yml               ← The Reviewer: LLM commit review on every push
│       ├── rituals.yml                ← Scheduled ritual runs from docs/rituals manifests
│       ├── semantic-release.yml       ← The Herald: automated release + npm publish
│       └── vscode-extension.yml       ← The Envoy: build and test VS Code extension
│
├── .githooks/                       ← Local git hook enforcement
│   ├── commit-msg                   ← Validates commit message format
│   ├── pre-commit                   ← Blocks main commits, scans secrets
│   ├── pre-push                     ← Enforces ticket-first branch naming
│   └── prepare-commit-msg           ← Injects commit message template
│
├── evals/                           ← Evaluation suites and benchmarks
├── examples/                        ← Complete example skills
├── references/                      ← Reference material
├── scripts/                         ← Repository maintenance scripts
│
├── vscode-extension/                ← VS Code extension
│   ├── src/
│   └── package.json
│
└── tests/                           ← Test suite
    ├── commands/                    ← CLI command tests
    ├── e2e/                         ← End-to-end tests
    ├── integration/                 ← Cross-module tests
    ├── scripts/                     ← Repository script tests
    ├── unit/                        ← Unit tests (agents, core, llm, memory, rag, skills)
    └── helpers/                     ← Test utilities
```

## Decision records

The full index of architecture decisions is in [docs/adr/README.md](docs/adr/README.md).

## Documentation map

Entry points for the documents that no code imports. `docs/rituals/` stays out
of this list because it is runtime data read by `agenthood ritual list`.

- **Governance**: [member map](docs/governance/member-map.md), [release policy](docs/governance/release-policy.md), [agent analysis data handling](docs/governance/agent-analysis-data.md)
- **Guides**: [adding a provider](docs/guides/adding-a-provider.md), [client implementation](docs/guides/client-implementation.md), [skill migration](docs/guides/skill-migration.md), [skills and MCP](docs/guides/skills-mcp-integration.md)
- **Members**: [identity card index](docs/members/README.md)
- **Portals**: [external system connectors](docs/portals/README.md)
- **Workflows**: [agentic workflow templates](docs/agentic-workflows/README.md)
- **Conventions**: [commit convention](docs/conventions/COMMIT_CONVENTION.md)
- **Templates**: [postmortem](docs/templates/postmortem.md)
