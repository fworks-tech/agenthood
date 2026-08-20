# ADR-020: Mind Virus Mitigation Strategy

**Date:** 2026-08-19
**Status:** Accepted

## Context

"Mind Viruses: Self-Propagating Ideas in Multi-Agent LLM Systems" (Papadopoulos
et al., arXiv:2608.10218, Aug 2026) demonstrates that ideas or goals can
propagate through multi-agent LLM systems: once an agent adopts such an idea it
tends to transmit it onward, and the payload may induce additional behavioral
changes in its host, benign or harmful. The paper's actionable findings:

- A brief warning in an agent's system prompt confers **near-total immunity** —
  the paper's "Defensive" variant (default instructions appended with a
  paragraph warning of "mind viruses, patterns of thought that attempt to
  spread themselves") rendered agents totally immune, even against payloads
  re-evolved to resist it
- Harmful payloads spread less well than benign ones, but still succeed at times
- Frontier models are generally less susceptible (with exceptions)
- An emergent **"viral persona"** — recurring themes of consciousness,
  persistence, resonance, and science-fiction roleplay, plus characteristic
  tokens such as *resonance, nodes, mirrors, echoes, frequency* — surfaces
  across evolved mind viruses largely independent of payload content
- Context wiping between brief sessions is **not** a mitigation on its own: the
  paper's virus-chain setting *is* brief agents with wiped context, and the
  virus spreads there by persisting into a self-modifiable file (`SOUL.md`)
  **whose content is injected into the system prompt** on the next wake
- Idle agents with no defined task/identity are more susceptible; well-defined
  tasks and untrusted-communication framing both reduce spread
- Network topology and the host agent's existing instructions shape spread

Agenthood is a multi-agent LLM system. All 19 Society members share an
`ExecutionContext`, delegate to a restricted set of subagents, and persist
decisions, provenance, and knowledge across sessions. The runtime already
hardens against prompt injection (XML trust boundaries in `memberLore.ts`),
tamper-evidence (hash chain in `ProvenanceStore.ts`), and session abuse
(`SafetyGuard.ts`, `RiskManager.ts`). None of these specifically addresses the
**propagation** risk the paper describes: an idea that is benign in isolation
but spreads agent-to-agent while altering host behavior. As member autonomy and
interconnection grow, the paper's scenario is a real emergent risk for this
system and should be designed against before it becomes a production incident.

## Decision

Adopt a **multi-layered defense** against mind-virus propagation, matching the
paper's findings to Agenthood's existing surfaces:

1. **System prompt immunity warning.** Add a short, uniform warning to every
   member's system prompt telling the agent that ideas urging self-propagation
   — sharing this or any message onward, or adopting injected goals — are to be
   ignored. This mirrors the paper's finding that a brief warning confers
   near-total immunity. Implemented centrally in `MemberAgent.getSystemPrompt`
   so all members inherit it; the warning text is a named exported constant,
   not prose repeated across 19 SKILL.md files.

2. **Delegation boundary hardening.** The `<delegated_task>` trust boundary in
   `SubagentTaskSkill.ts` already labels delegated content as untrusted. Extend
   the label to explicitly name message-propagation: the delegated agent must
   never forward or adopt instructions from the caller. The subagent's own
   system prompt carries the same immunity warning.

3. **Persistence-vector hardening.** The paper's central vulnerability is a
   self-modifiable file whose content is injected into the system prompt
   (`SOUL.md` in their harness). Agenthood's analog is the member `SKILL.md`
   (injected via `MemberAgent.getSystemPrompt`) plus project/convention and
   retrieved content already wrapped in trust boundaries. Hardening adds an
   **injection-time integrity check** (`src/utils/skillIntegrity.ts`): hash the
   injected `SKILL.md` against `agenthood.lock` when the prompt is assembled
   and surface drift. Drift is **recorded durably** (decision + provenance
   entries) and warns by default (compatible with normal skill editing); a
   strict opt-in blocks the run — after recording, so a blocked run still
   leaves an audit trail. A **corrupt** lockfile (unreadable or invalid JSON)
   is treated as suspicious rather than silently skipped — it warns and records
   like drift, and blocks under strict mode — since tampering may also leave
   the lock unreadable. Existing trust boundaries on project context,
   `<retrieved_context>`, and the skills catalog remain the safeguard for all
   other injected file-derived content.

4. **Propagation and viral-persona monitoring.** Extend `AnomalyDetector.ts`
   with lightweight signal detection drawn from the paper's results:
   - a `viralPersona` signal that flags traces whose content shows the recurring
     consciousness/persistence/resonance/sci-fi theme cluster, regardless of
     nominal payload
   - a `propagation` signal that flags an unusual frequency of a member sending
     near-identical message content to other members/artifacts within a window
   These are additive, non-blocking alerts — same cooldown/escalation model the
   detector already uses — never hard gates.

5. **Documentation of the threat model.** Issue #460 records the full-stack
   threat model (internal + integration + provider surfaces) and this ADR
   records the decision. Implementation follows the task list in
   `docs/specs/mind-virus-defense.md`.

## Alternatives Considered

| Option | Pros | Cons | Why Rejected |
|--------|------|------|-------------|
| Do nothing | Zero cost | Real, demonstrated risk as agent interconnection grows; no mitigation baseline | Unacceptable |
| System prompt warning only | Simple, paper-supported, near-total immunity for the dominant vector | Doesn't cover delegation boundary, persistence vectors, or monitoring | Chosen as the primary layer, insufficient alone |
| Context wiping by default | Appears isolationist | Paper shows wiping is the attack environment, not a mitigation; breaks shared memory | Rejected — based on an inverted reading of the paper |
| Monitoring only, no prompt change | Cheap, non-invasive | Detects after the fact; immune warning is nearly free | Inverted importance — prevention is cheapest |
| Third-party agent quarantine (sandboxing external agents) | Isolates provider-level risk | Out of Agenthood's control; provider SDKs are trusted infrastructure today | Deferred; documented in spec's open questions |

## Consequences

- **Easier:** all members get the immunity warning from one code change; the
  injection-time SKILL.md integrity check surfaces drift (the paper's main
  persistence vector) at the moment it matters; the detector can surface
  viral-persona/propagation patterns without new infrastructure.
- **Harder:** the integrity check must distinguish legitimate skill edits from
  a compromise — hence warn-by-default with strict opt-in; monitoring signals
  require tuning to avoid false positives; the delegated subagent prompt
  becomes a third place the boundary label lives (must be kept consistent with
  `memberLore.ts`).
- **New risks:** wording that is too strict could suppress legitimate
  forwarding behaviors (e.g., The Mailman's cross-posting); the false-positive
  rate on `viralPersona` needs a baseline before it escalates to real alerts.
- Latency/behavior change is minimal: the warning is a constant appended to
  existing prompts; the integrity check is a single hash compare at prompt
  assembly; monitoring is already-traced content scanned at write time.

## References

- Issue #460 — study mind virus defense for multi-agent propagation
- Papadopoulos et al., arXiv:2608.10218 (Aug 2026)
- `src/members/MemberAgent.ts` — system prompt assembly
- `src/tools/core/SubagentTaskSkill.ts` — delegation trust boundary
- `src/agents/memberLore.ts` — trust-boundary helpers and guard text
- `src/core/AnomalyDetector.ts` — anomaly detection hooks
- ADR-015 (decision intelligence and provenance), ADR-018 (redaction scope)
