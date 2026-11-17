# Architecture Decision Records

This is the index of every ADR in the repository, in number order. The title
and the date come from each ADR file; the summary is a short description of the
decision. ADR-006 and ADR-007 have no file left, so they appear as retired rows
to explain the gap in the numbering.

| Número | Título | Data | Status | Resumo |
|--------|--------|------|--------|--------|
| 001 | [ADR-001: Markdown-Based Skills Over Code-Based Agents](ADR-001-markdown-skills-over-code-agents.md) | 2026-06-02 | Accepted | Members are Markdown skill files loaded into the developer's AI runtime as instructions. |
| 002 | [ADR-002: Conventional Commits as the Commit Standard](ADR-002-conventional-commits-standard.md) | 2026-06-02 | Accepted | Commits follow Conventional Commits with a curated set of allowed types. |
| 003 | [ADR-003: Dual Enforcement via Bash Hooks and Commitlint](ADR-003-dual-enforcement-hooks-and-commitlint.md) | 2026-06-02 | Accepted | Local hooks and commitlint enforce commit rules at two layers. |
| 004 | [ADR-004: 16 Specialized Members Over a General-Purpose Agent](ADR-004-specialized-members-over-general-agent.md) | 2026-06-02 | Accepted | The Society uses named specialist roles instead of one general agent. |
| 005 | [ADR-005: Orchestrator Pattern Over Peer-to-Peer Member Communication](ADR-005-orchestrator-pattern.md) | 2026-06-02 | Accepted | A human or the Steward routes work; members do not call each other. |
| 006 | ADR-006: Python runtime | n/a | Retired | Deleted and replaced by ADR-008; the separate Python package never shipped. |
| 007 | ADR-007: DeepAgents runtime | n/a | Retired | Deleted and replaced by ADR-008; DeepAgents and LangGraph were dropped. |
| 008 | [ADR-008: TypeScript-Native Runtime Over Python + DeepAgents](ADR-008-typescript-runtime-over-python.md) | 2026-06-02 | Accepted | The agentic runtime is TypeScript inside the Node.js package, with no Python stack. |
| 009 | [ADR-009: Groq as the Default Free LLM Provider](ADR-009-groq-as-default-llm-provider.md) | 2026-06-02 | Accepted | Groq's free tier and OpenAI-compatible API make it the default provider. |
| 010 | [ADR-010: LanceDB for Vector Storage](ADR-010-lancedb-for-vector-storage.md) | 2026-06-02 | Accepted | LanceDB is the embedded, file-based vector store under `.agenthood/memory/`. |
| 011 | [ADR-011: Rate Limiter and State Store](ADR-011-rate-limiter-and-state-store.md) | 2026-06-24 | Accepted | Rate limiting is split across two layers with separate state concerns. |
| 012 | [ADR-012: Error Handling and Resilience Strategy](ADR-012-error-handling-and-resilience.md) | 2026-06-24 | Accepted | Failures are classified and routed through provider fallback and escalation. |
| 013 | [ADR-013: Distribution Channel Priority](ADR-013-distribution-channel-priority.md) | 2026-06-24 | Accepted | Channels are ranked so npm remains the primary distribution path. |
| 014 | [ADR-014: EvalResult in Core Types](ADR-014-evalresult-in-core-types.md) | 2026-06-28 | Accepted | `EvalResult` lives in core types as the shared evaluation result shape. |
| 015 | [ADR-015: Decision Intelligence and Provenance](ADR-015-decision-intelligence-and-provenance.md) | 2026-08-11 | Accepted | Decisions and provenance are stored as JSON under `.agenthood/` with no new dependencies. |
| 016 | [ADR-016: LLM-as-Judge Evaluation Pipeline](ADR-016-llm-judge-evaluation-pipeline.md) | 2026-08-14 | Accepted | Evaluation uses a pluggable judge, per-member baselines and replay. |
| 017 | [ADR-017: Semantic Learning via Embedding Index](ADR-017-embedding-index-semantic-learning.md) | 2026-08-14 | Accepted | `EmbeddingIndex` owns persistence and nearest-neighbour pattern search. |
| 018 | [ADR-018: Redaction Scope Extended to Decision and Provenance Payloads](ADR-018-redaction-scope-for-decisions.md) | 2026-08-14 | Accepted | One redactor at one boundary scrubs stored decision and provenance data. |
| 019 | [ADR-019: Executor contract returns model attribution](ADR-019-executor-contract-model-attribution.md) | 2026-08-15 | Accepted | The executor returns the model name alongside generated output. |
| 020 | [ADR-020: Mind Virus Mitigation Strategy](ADR-020-mind-virus-mitigation.md) | 2026-08-19 | Accepted | Several layers defend against prompt-driven propagation across members. |
| 021 | [ADR-021: Society Projection as a Live Surface](ADR-021-society-projection-as-live-surface.md) | 2026-08-21 | Accepted | Provenance and decisions are exposed as a read-only projection contract. |
| 022 | [ADR-022: Monetisation Model](ADR-022-monetisation-model.md) | 2026-09-04 | Proposed | Open-core direction: the core stays MIT, paid tiers add hosting and team tools. |
| 023 | [ADR-023: Third-Party Member Plugin API](ADR-023-third-party-member-api.md) | 2026-09-04 | Proposed | Registry-first discovery with a curated allowlist for external members. |
| 024 | [ADR-024: Tiered Memory Model with Per-Tier Bounds](ADR-024-memory-tiers.md) | 2026-09-21 | Accepted | Memory is divided into bounded tiers matched to their access patterns. |
| 025 | [ADR-025: ReAct Tool Loop for Member and Core-Agent Runs](ADR-025-react-loop.md) | 2026-09-21 | Accepted | `ReActLoop` alternates reasoning and tool calls until a final answer or step cap. |
| 026 | [ADR-026: tree-sitter for Structural Code Analysis](ADR-026-tree-sitter-parsing.md) | 2026-09-21 | Accepted | tree-sitter grammars extract structured `CodeEntity` records from source. |
| 027 | [ADR-027: Provider Chain with Circuit Breaker and Per-Request Timeout](ADR-027-provider-failover.md) | 2026-09-21 | Accepted | An ordered provider chain adds circuit breaking and request timeouts. |
| 028 | [ADR-028: SKILL.md Frontmatter as an Enforced Contract](ADR-028-skill-frontmatter-contract.md) | 2026-09-21 | Accepted | Frontmatter fields are parsed, validated and enforced at discovery. |
| 029 | [ADR-029: Fail-Closed Skill Trust and Prompt-Injection Detection](ADR-029-fail-closed-skill-trust.md) | 2026-09-25 | Accepted | Trust levels are fail-closed, with the strongest applicable level winning. |
| 030 | [ADR-030: Metrics Export Schema and Privacy Boundary](ADR-030-metrics-export-schema.md) | 2026-09-25 | Accepted | Metrics export is opt in, local source and redaction safe by construction. |
| 031 | [ADR-031: Custom Member Registry](ADR-031-custom-member-registry.md) | 2026-11-15 | Accepted | Hosts register custom members as data at application construction. |
| 032 | [ADR-032: Enforce Skill Tool Declarations](ADR-032-skill-tool-enforcement.md) | 2026-11-15 | Accepted | `allowed-tools` is checked at call time before a tool runs. |
| 033 | [ADR-033: Chains as Runtime Workflows](ADR-033-chain-workflows.md) | 2026-11-15 | Accepted | `chains.yaml` becomes a runtime input with guards and checkpoints. |
| 034 | [ADR-034: Per-Step Trajectory](ADR-034-per-step-trajectory.md) | 2026-11-15 | Accepted | Each loop turn is recorded as a `TrajectoryStep` and persisted. |
| 035 | [ADR-035: Skill Namespaces and `.well-known` Catalog Distribution](ADR-035-skill-namespaces-and-well-known-catalogs.md) | 2026-11-15 | Accepted | Namespaces qualify skill names and `.well-known` carries remote catalogs. |
| 036 | [ADR-036: Skill Script Execution and Sandboxing](ADR-036-skill-script-execution-and-sandboxing.md) | 2026-11-15 | Accepted | One tool runs only declared scripts under a sandbox. |
| 037 | [ADR-037: Skill Usability Gating, Variants and Global Scope](ADR-037-skill-usability-gating-and-variants.md) | 2026-11-16 | Accepted | One discovery-time gate decides usability, variants and global scope. |
| 038 | [ADR-038: Skill Discovery and Execution Caching](ADR-038-skill-discovery-and-execution-caching.md) | 2026-11-16 | Accepted | Metadata is cached and invalidated by stat checks. |
| 039 | [ADR-039: Member Naming and Identity](ADR-039-member-naming-and-identity.md) | 2026-11-16 | Superseded by ADR-044 | Defines the role naming rules; its prefixed directory rule is superseded. |
| 040 | [ADR-040: SKILL.md Body Structure](ADR-040-skill-body-structure.md) | 2026-11-16 | Accepted | A member body has six ordered sections that the Sentinel checks. |
| 041 | [ADR-041: Member Tool Permission Model](ADR-041-member-tool-permission-model.md) | 2026-11-16 | Accepted | Effective tools are the intersection of `allowed-tools` and the profile grant. |
| 042 | [ADR-042: Provider Routing for Member Runs](ADR-042-provider-routing-for-member-runs.md) | 2026-11-16 | Accepted | Static routing is the default; members may opt into other strategies. |
| 043 | [ADR-043: Dependency Audit Exception Policy](ADR-043-dependency-audit-exception-policy.md) | 2026-11-17 | Accepted | Dated, scoped allowlist entries in the audit gate, with a dev-only waiver. |
| 044 | [ADR-044: Member Naming Uses the Shipped Unprefixed Layout](ADR-044-member-naming-shipped-layout.md) | 2026-11-17 | Accepted | The unprefixed skill directory and `name` are authoritative; `the-*` stays an alias. |

## How the index is maintained

An ADR is written when a decision changes the architecture or a convention that
would be expensive to reverse. Its status moves to `Superseded` when a later ADR
replaces it; the older file stays with a status that points to its replacement.
A decision that is deleted rather than replaced becomes `Retired`: ADR-006 and
ADR-007 have no file left, and their rows remain here to explain the gap. No
number is reused to close the gap, because the gap is part of the history.
