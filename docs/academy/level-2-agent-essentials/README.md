# Level 2 — AI Agent Essentials

> *Most developers know about agents. Most developers' agents do not work. This level is the difference.*

Eleven articles. The concepts where most people quit. Do not quit here.

---

## Articles

| # | Article | Agenthood Component |
|---|---------|---------------------|
| 1 | [What Are AI Agents](01-what-are-ai-agents.md) | `BaseAgent`, `ReActLoop` |
| 2 | [Agentic Frameworks](02-agentic-frameworks.md) | ADR-008 — why Agenthood builds its own |
| 3 | [Build Your First Agent](03-build-your-first-agent.md) | `DeveloperAgent` extending `BaseAgent` |
| 4 | [Agent Workflows](04-agent-workflows.md) | `WorkflowEngine` (planned), step types |
| 5 | [Agent Memory](05-agent-memory.md) | Short/Long/Episodic/Project/Residual memory tiers |
| 6 | [Agent Evaluation](06-agent-evaluation.md) | `EvalRunner` (planned), 4 metrics |
| 7 | [Multi-Step Reasoning](07-multi-step-reasoning.md) | `ReActLoop`, `ChainOfThought` |
| 8 | [Multi-Agent Systems](08-multi-agent-systems.md) | `WorkflowEngine` (planned), `ParallelStep` (planned), ADR-005 |
| 9 | [Agentic RAG](09-agentic-rag.md) | `AgenticRAG`, `RetrievalClassifier` |
| 10 | [Action Planning](10-action-planning.md) | `PlanSkill` (planned), `ArchitectAgent` |
| 11 | [Safety and Guardrails](11-safety-and-guardrails.md) | `RiskManager`, `ThinkingBudget`, `SafetyGuard` |
| 12 | [M5 — Intelligence](12-m5-intelligence.md) | `MarkdownHierarchicalChunkStrategy`, `AgenticRAG`, `MemberOrchestrator`, Governance docs |

---

## What Level 2 covers

The gap between "knowing about agents" and "building agents that work." These eleven concepts are where production systems diverge from demos. Every one maps to an Agenthood component that handles it correctly — or a gap in the ecosystem that Agenthood was built to fill.

Finish Level 2, then go to [Level 3 — Advanced Agent Skills](../level-3-advanced-skills/README.md).
