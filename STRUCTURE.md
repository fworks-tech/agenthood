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
├── members/                         ← agent skill files
│   ├── the-scribe/
│   ├── the-architect/
│   ├── the-strategist/
│   ├── the-reviewer/
│   ├── the-tester/
│   ├── the-debugger/
│   ├── the-auditor/
│   ├── the-herald/
│   ├── the-librarian/
│   ├── the-doorman/
│   ├── the-operator/
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
│   ├── commands/                    ← CLI commands (init, check, run, list, verify, rollback, status, workflow, pr-sync, setup, oath, eject, activate, deactivate)
│   ├── agents/                      ← BaseAgent + AgentRegistry (Oracle, Strategist, Operator + Developer, Architect, Reviewer, QA)
│   ├── llm/                         ← ILLMProvider, LLMRouter, 4 providers
│   ├── skills/                      ← ISkill, SkillRegistry
│   ├── core/                        ← SafetyGuard, ConcurrencyQueue, RiskManager, SchemaValidator
│   ├── reasoning/                   ← ReActLoop, ThinkingBudget
│   ├── workflows/                   ← WorkflowEngine, QualityGates, DiffImpactAnalyzer, WorkflowCheckpoint, GoalChain
│   ├── memory/                      ← ResidualMemory, IMemoryStore, VectorStore (LanceDB), ShortTermMemory, LongTermMemory, EpisodicMemory, ProjectMemory, PersonalisationStore
│   ├── memory/stores/               ← InMemoryStore
│   ├── rag/                         ← KnowledgeGraphStore, ChunkStrategy, Indexer, Retriever
│   ├── rag/parsers/                 ← TreeSitterParser (AST code structure extraction)
│   ├── project/                     ← SocietyIndexer, ProjectIngestion
│   ├── utils/                       ← contentHash (SHA-256), loadLockfile, Lockfile type
│   ├── members/                     ← MemberRegistry, MemberAgent
│   └── prompts/                     ← Templates, PromptBuilder, PromptRegistry
│
├── .github/                          ← CI and contribution automation
│   ├── actions/agent-analysis/        ← Shared composite action for LLM agent checks in CI
│   └── workflows/                     ← CI enforcement
│   ├── pr.yml                       ← The Doorman, Auditor, Scribe, Warden, Librarian, Sentinel, Tester — PR standards (7 checks merged)
│   ├── reviewer.yml                 ← The Reviewer — LLM commit review on every push
│   ├── herald.yml                   ← The Herald — CI summary comment on PRs
│   ├── semantic-release.yml         ← The Herald — automated release + npm publish
│   ├── vscode-extension.yml         ← The Envoy — build and test VS Code extension
│   ├── publish-vsce.yml             ← The Envoy — publish VSIX to Marketplace
│   └── distribution.yml             ← The Envoy — Skills.sh, SkillsMP, traction badges
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
