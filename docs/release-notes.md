# 📦 Release Notes

> Full version history for [Agenthood](https://github.com/fworks-tech/agenthood).
> Generated automatically — do not edit manually.

---

## v3.4.0 — June 28, 2026

### 🐛 Bug Fixes

- **Evals:** import ExecutionContext from correct module
- **Evals:** import ExecutionContext from correct module in tests

### ✨ Features

- **Evals:** implement EpisodeLearner — update LongTermMemory and ResidualMemory from eval scores

---

## v3.3.0 — June 28, 2026

### 🐛 Bug Fixes

- correct vitest JSON field names (num prefix), remove duplicate detect block in run.ts

### ✨ Features

- **Core:** implement metrics collector, status --watch/--json/--drift, quality gates drift detection and config

---

## v3.2.0 — June 28, 2026

### 🐛 Bug Fixes

- address all review findings across 7 phase branches
- remove hardcoded member count from steward readme (maintenance trap)
- steward pre-load count should be 15 (16 members - 1 for steward itself)
- sync skills/ directory with members/ for ci compliance
- use 16 not 15 for steward pre-load count (matches registry)

### ✨ Features

- **Phase:** phase 0 - decision log, postmortem, auto-discover #280 #114
- **Phase:** phase 1 - protocol interfaces and workflow engine #116
- **Phase:** phase 2 - workflow checkpoint and goal chain #118
- **Phase:** phase 3 - oracle, strategist, and operator agents #277 #278
- **Phase:** phase 4 - verify, rollback, and status commands #276 #281
- **Phase:** phase 5 - diff impact analyzer and quality gates #282
- **Phase:** phase 6 - review-pr workflow end-to-end

---

## v3.1.0 — June 27, 2026

### 🐛 Bug Fixes

- **Docs:** address Reviewer findings on init check count and LanceDBStore API example
- **Docs:** correct check count to 21 and fix insert->add API example
- **Docs:** fix mentioned shipped version
- **Init,check:** align init ceremony with health check expectations
- **Skills:** add output format section to the-reviewer SKILL.md for consistent rendering
- sync skills/the-reviewer/SKILL.md with members/ changes
- **The-reviewer:** address review findings on output format and README
- **The-reviewer:** flatten heading hierarchy and add intra-section spacing example
- **The-reviewer:** use [SEVERITY] placeholder and move meta-instruction outside template

### ✨ Features

- load .env file automatically via dotenv

---

## v3.0.0 — June 26, 2026

### 🐛 Bug Fixes

- address PR review feedback and update docs
- **Ci:** add GITHUB_TOKEN to Run Reviewer step
- **Ci:** address reviewer feedback on gh pr view error handling
- **Ci:** convert skills/ symlinks to regular files
- **Ci:** ensure all gh commands have GITHUB_TOKEN auth
- **Ci:** fix YAML indentation in sentinel, auditor, warden workflows
- **Ci:** install gitleaks binary before pre-check step
- **Ci:** remove noisy gitleaks pre-check step
- **Ci:** update sentinel to check file content instead of symlinks
- **Cli:** wire detect flag through CLI parser
- implement all review findings from architect and reviewer
- **Security:** address all Auditor findings from PR #285

### 📝 Documentation

- **Governance:** create member RACI map and release policy

### ✨ Features

- **Ci:** make API usage smart and economic
- **Llm:** add OpenCode Go provider
- **Llm:** add OpenCode Zen provider
- **Llm:** fix OpenCode provider for DeepSeek tool format compatibility
- **Orchestration:** implement MemberOrchestrator detection
- **Rag:** implement AgenticRAG with RetrievalDecisionSkill
- **Rag:** implement HierarchicalChunkStrategy with parent-child chunking

### 🔹 BREAKING CHANGES

- **Governance:** announcements, deprecation policy, compliance

---

## v2.5.1 — June 26, 2026

### 🐛 Bug Fixes

- **Memory:** align ProjectMemoryImpl return types with ProjectMemory interface

---

## v2.5.0 — June 26, 2026

### 🐛 Bug Fixes

- **Deps:** pin tree-sitter-go and tree-sitter-python to v0.23.x to resolve peer dependency conflict

### ✨ Features

- **Memory:** implement PersonalisationStore for per-project agent adaptation, closes [hi#weight](https://github.com/hi/issues/weight) #112
- **Memory:** implement ShortTerm, LongTerm, Episodic, and Project memory tiers
- **Rag:** implement baseline RAG pipeline — ChunkStrategy, Indexer, Retriever
- **Rag:** implement SocietyIndexer for members, ADRs, and conventions
- **Rag:** implement TreeSitterParser for AST-based code structure extraction

---

## v2.4.0 — June 26, 2026

### 🐛 Bug Fixes

- address reviewer findings and update Phase 0 docs
- ignore entire .agenthood/ directory except config.example.json
- **Llm:** extract and granularize api key validation

### ✨ Features

- **Core:** move schema validator to core and harden error messages
- **Memory:** implement LanceDB vector store with IVectorStore interface
- **Memory:** implement memory governance with IMemoryStore and InMemoryStore
- **Memory:** implement ResidualMemory — decay-weighted trace signals
- **Rag:** implement KnowledgeGraphStore for relationship-aware retrieval
- **Reasoning:** add infinite loop detection to reactloop

---

## v2.3.1 — June 25, 2026

### 🐛 Bug Fixes

- **Workflows:** correct yaml indentation in member attribution comments (#260)

---

## v2.3.0 — June 25, 2026

### 🐛 Bug Fixes

- **Academy:** compute relative link from non-index pages at correct depth
- **Failover:** add embed model downgrade, 3-attempt backoff, JSDoc, align with spec
- **Failover:** trip permanent errors immediately, add model downgrade to stream()

### ✨ Features

- **Cli:** add provider selection logging, runtime guide, and failover integration tests
- **Cli:** wire provider failover config into CLI and LLMRouter
- **Provider:** implement model downgrade and circuit breaker config

---

## v2.2.0 — June 23, 2026

### 🐛 Bug Fixes

- **Academy:** compute relative links from file dir instead of docs root

### ✨ Features

- **Academy:** replace MkDocs with Node.js build and deploy to GitHub Pages

---

## v2.1.0 — June 23, 2026

### 🐛 Bug Fixes

- **Ci:** add npm ci step to gh-pages workflow before building, closes [#pages](https://github.com/fworks-tech/agenthood/issues/pages)
- **Config:** update stale commitlint.config.cjs references to .ts
- **Llm:** make provider SDK imports lazy, lower engines.node to 22.14.0

### ✨ Features

- **Academy:** replace MkDocs with Node.js build and deploy to GitHub Pages

---

## v2.0.0 — June 21, 2026

### 🐛 Bug Fixes

- **Agents:** add missing contextCompressor property declaration
- **Ci:** add build step before pr-sync in The Manuscript workflow
- **Ci:** fail gracefully on push events and split workflow triggers
- **Ci:** use node dist/cli.js instead of npx to avoid permission denied
- **Pr-sync:** use PR head SHA and preserve existing PR body
- **Providers:** handle missing GROQ_API_KEY in GroqProvider constructor
- remove dead ContextCompressor import that breaks build
- remove duplicated docs
- **Tests:** correct Artifact interface usage and add JSON.parse error handling
- **Test:** update commitlint test to import .ts config directly
- **Vscode-extension:** move test config to src/ for 100% typescript compilation

### 🔹 chore

- **Release:** mark v2.0.0 breaking changes

### ✨ Features

- add GroqProvider tests, schema validation, and runtime documentation
- **Agent:** implement ArchitectAgent, ReviewerAgent, QAAgent runtime classes
- **Commands:** add pr-sync command, PrSyncSkill, and The Manuscript workflow, closes [#based](https://github.com/fworks-tech/agenthood/issues/based)
- **Core:** add concurrency queue and safety guard
- **Core:** add RiskManager, SkillRegistry discovery, dynamic routing, and README rewrite #162 #102 #102 #103 #162
- **Core:** implement ContextCompressor with token-aware memory summarization
- **Core:** security hardening — Ajv, API key validation, symlink checks
- **Llm:** add Anthropic prompt caching with cache control breakpoint
- **Llm:** implement ProviderFailover for resilience (#161)
- **Llm:** provider failover with circuit breaker and per-member preferences
- **Members:** wire all 14 society members to agenthood run
- **Reasoning:** implement ContextCompressor for token management (#104)
- **Release:** generate user-friendly release notes via @semantic-release/exec
- **Runtime:** release v2.0.0 — TypeScript runtime with autonomous agent execution
- ship M4 foundation - TypeScript runtime with providers, agents, skills, and CLI
- **Skills:** export and register SubagentTaskSkill with delegate_task name #8 #9
- **Skills:** implement SubagentTaskSkill for agent delegation (#199)
- **Skills:** replace stub skills with real LLM and filesystem implementations
- **Workflow:** replace commit listing with LLM code review by The Reviewer

### 🔹 BREAKING CHANGES

- **Release:** The Manuscript PR body sync is replaced by The Reviewer commit review. The Python runtime and runtime/ directory are removed. The Society now runs exclusively on the TypeScript runtime with Groq as the default provider.

---

## v1.10.0 — June 20, 2026

### ✨ Features

- **Skills:** add skills/ symlinks for all 14 members and Sentinel validation

---

## v1.9.1 — June 20, 2026

### 🐛 Bug Fixes

- **Academy:** remove source CNAME to prevent gh-pages redirect loop, closes [#pages](https://github.com/fworks-tech/agenthood/issues/pages)

---

## v1.9.0 — June 20, 2026

### 🐛 Bug Fixes

- **Distribution:** add owner email and align version with repo release v1.8.4
- **Dot-folders:** audit and repair githooks, devcontainer, gitignore, and stale dirs

### ✨ Features

- **Distribution:** add .claude-plugin marketplace.json for Claude Code plugin discovery
- **Workflows:** add Herald CI summary workflow that posts PR verdict comment

---

## v1.8.4 — June 19, 2026

### 🐛 Bug Fixes

- **Academy:** revert GitHub Pages custom domain config (#194)

---

## v1.8.3 — June 18, 2026

### 🐛 Bug Fixes

- **Academy:** move CNAME to docs root for GitHub Pages (#191)

---

## v1.8.2 — June 18, 2026

### 🐛 Bug Fixes

- **Academy:** quote ADR nav title to fix YAML syntax (#187)

---

## v1.8.1 — June 18, 2026

### 🐛 Bug Fixes

- **Academy:** resolve ADR rendering and broken cross-links (#186)

---

## v1.8.0 — June 17, 2026

### ✨ Features

- **Registry:** submit Agenthood to SkillsMP and Skills.sh (#184)

---

## v1.7.2 — June 17, 2026

### 🐛 Bug Fixes

- **Skill:** normalize SKILL.md structure for milestone M1 (#183)

---

## v1.7.1 — June 17, 2026

### 🐛 Bug Fixes

- **Docs:** correct broken ADR-010 references and Academy CTA URLs (#180)

---

## v1.7.0 — June 17, 2026

### ✨ Features

- **Npm:** improve package visibility with better keywords and badges

---

## v1.6.7 — June 17, 2026

### 🐛 Bug Fixes

- **Ci:** remove registry-url and upgrade to Node 22 for npm OIDC
- **Ci:** switch to OIDC trusted publisher for npm publishing

---

## v1.6.6 — June 15, 2026

### 🐛 Bug Fixes

- **Ci:** restore npm auth wiring for semantic-release (#164)
- **Release:** enable npm publishing in semantic-release (#146)

---

## v1.6.5 — June 13, 2026

### 🐛 Bug Fixes

- **Release:** add semantic-release git plugin for changelog commits
- **Release:** enable npm publishing in semantic-release configuration

---

## v1.2.3 — June 8, 2026

### 🐛 Bug Fixes

- **Docs:** restore missing changelog entries for v1.1.0-v1.2.1 (#83)

---

## v1.2.2 — June 8, 2026

### 🐛 Bug Fixes

- **Release:** wire up npm publishing pipeline (#82)

---

## v1.2.1 — June 8, 2026

### ✨ Features

- add integration test framework and improve TypeScript setup (#64)

---

## v1.2.0 — June 2, 2026

### ✨ Features

- **Vscode:** implement workspace event bus for passive observation (#62)

---

## v1.1.1 — June 2, 2026

### 🐛 Bug Fixes

- **Security:** remove embedded credential examples from docs (#61)

---

## v1.1.0 — June 2, 2026

### 🐛 Bug Fixes

- **Release:** drop @semantic-release/git plugin (#55)

### ✨ Features

- **Runtime:** bootstrap Python package and 14-member registry (#51)
- **Vscode:** modernize with build, tests, and CI (#54)

---

## v1.0.3 — June 2, 2026

### 🐛 Bug Fixes

- **Release:** remove prepublishonly script (#40)

---

## v1.0.2 — June 2, 2026

### 🐛 Bug Fixes

- **Ci:** run npm ci before semantic-release to satisfy prepublishOnly (#38)
- **Ci:** use npm install instead of npm ci (no lockfile) (#39)

---

## v1.0.1 — June 2, 2026

### 🐛 Bug Fixes

- **Ci:** pass NPM_TOKEN to semantic-release and install npm plugin (#37)
- **Release:** enable npm publish now that NPM_TOKEN is configured (#36)

---

## v1.0.0 — June 2, 2026

### 🐛 Bug Fixes

- **Agents:** update stale member count from 13 to 14
- **Check:** validate all 14 members in health check (#27) #26
- **Ci:** add ADR presence check to librarian.yml (#20)
- **Ci:** add AGENTS.md to sentinel.yml trigger paths (#19)
- **Ci:** fix sentinel multi-word section checks
- **Ci:** use commitlint.config.cjs for esm compat
- **Conventions:** add vague-subject rule to commitlint config
- **Docs:** correct member count to fourteen
- **Gitmessage:** replace project-specific scope examples with generic placeholders
- **Portals:** create missing linear.md and jira.md connector docs (#28)
- **Release:** disable npm publish until NPM_TOKEN is configured (#33)

### ✨ Features

- **Adr:** create foundational ADRs for Agenthood's own architecture (#30)
- **Agentic-workflows:** clarify workflow files as manual-prompt templates (#31)
- **Bootstrap:** add .agenthood/config.example.json reference template
- **Bootstrap:** implement agenthood setup command and init CLI (#23)
- **Doorman:** add pre-push hook blocking direct push to main
- **Hooks:** add commit-msg hook
- **Hooks:** add pre-commit hook
- **Members:** add branch scope and PR scope validation to architect and doorman
- **Members:** add N+1 commit pattern and PR granularity to the-scribe
- **Members:** add the-envoy
- **Members:** add the-oracle
- **Members:** add the-sentinel
- **Members:** add the-steward
- **Members:** add the-warden
- **Members:** register the-oracle and the-envoy in indexes
- **Members:** register the-sentinel and the-warden in indexes
- **Platform:** add npm package, VS Code extension, portals rename, and INITIATION
- **Setup:** add setup.sh, makefile, devcontainer
- **Society:** add skill files, rituals, agentic workflows, CI, and intelligence
