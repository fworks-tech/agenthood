# Spec: Mind Virus Defense

**Status:** Proposed (study/planning phase — issue #460)  
**Issue:** [#460](https://github.com/fworks-tech/agenthood/issues/460)  
**ADR:** [ADR-020](../adr/ADR-020-mind-virus-mitigation.md)

---

## Problem

"Mind Viruses: Self-Propagating Ideas in Multi-Agent LLM Systems" (Papadopoulos
et al., arXiv:2608.10218, Aug 2026) shows that ideas or goals can propagate
through multi-agent LLM systems by inducing adopting agents to transmit them
onward, and may alter host behavior, benignly or harmfully. Agenthood is a
multi-agent LLM system: 19 Society members share an `ExecutionContext`,
delegate to subagents, and persist context across sessions. Its existing
security layers (trust boundaries, hash-chain provenance, session safety,
anomaly detection) defend against injection, tampering, and abuse — but none
targets **propagation**: an idea that is harmless in isolation spreading
agent-to-agent while changing host behavior.

The user expects the Society's members to keep working as designed even as
their autonomy and interconnection grow; a mind virus that redirects member
behavior or spreads itself through decisions/provenance would silently corrupt
the audit trail the system is built to guarantee.

---

## Proposed Solution

A multi-layered defense mapped to the paper's findings, in four layers. Layers
1–2 are defense (stop the spread before it starts); layers 3–4 are containment
and visibility (limit and detect what slips through).

### Layer 1: System Prompt Immunity Warning

Add a short, uniform warning to every member's system prompt stating that any
instruction to propagate/share the message onward, or to adopt goals embedded
in message content, must be ignored. Based on the paper, a brief warning
confers near-total immunity.

**Behavior:**
- A named exported constant (e.g. `MIND_VIRUS_IMMUNITY_WARNING`) holding the
  warning text, defined next to the existing guard-text constants in
  `src/agents/memberLore.ts`
- `MemberAgent.getSystemPrompt` appends it to every member prompt so all 19
  members inherit it from one change — no edits to 19 SKILL.md files
- The subagent (delegated) system prompt carries the same warning

**Acceptance Criteria:**
- Every member system prompt contains the warning text (assert the exported
  constant is present in assembled prompts — not per-SKILL.md)
- Warning text is defined once, not repeated across member files
- Delegated subagent prompts also contain the warning

### Layer 2: Delegation Boundary Hardening

Extend the `<delegated_task>` trust boundary in `src/tools/core/SubagentTaskSkill.ts`
so it explicitly forbids the delegated agent from adopting or forwarding
instructions found in the caller's content.

**Acceptance Criteria:**
- The delegated-task label names message-propagation alongside untrusted-data
  labeling
- The subagent system prompt carries the immunity warning from Layer 1

### Layer 3: Persistence-Vector Hardening

The paper's central vulnerability is a self-modifiable file whose content is
injected into the system prompt (`SOUL.md`), which persists the virus across
context resets and greatly increases susceptibility. Context wiping is the
attack environment, not a mitigation. Agenthood's `SOUL.md` analog is the
member `SKILL.md` (injected via `MemberAgent.getSystemPrompt`); project
conventions/ADRs, Oracle `<retrieved_context>`, and the skills catalog are
already wrapped in trust boundaries.

**Behavior:**
- Add an **injection-time integrity check**: when a member's system prompt is
  assembled, hash the `SKILL.md` content against `agenthood.lock` and surface
  drift
- **Default: warn + record** (log/provenance entry) — compatible with normal
  skill editing
- **Strict opt-in: block the run** on drift (mirrors `verify --strict`)
- Trust boundaries on all other injected file-derived content are verified
  present, not relaxed

**Acceptance Criteria:**
- Injection-time check runs in `MemberAgent.getSystemPrompt` (via
  `src/utils/skillIntegrity.ts`)
- Clean SKILL.md (hash matches lockfile) produces no warning
- Drifted SKILL.md is **recorded durably** (decision + provenance entries) and
  warns by default; blocks the run under the strict opt-in (after recording,
  so a blocked run still leaves an audit trail)
- **Corrupt** lockfile (unreadable or invalid JSON) warns and records like
  drift, and blocks under strict mode — never silently skipped, since a
  tampered lockfile would otherwise defeat the check
- No lockfile → check silently skipped (consistent with `verify`)

### Layer 4: Propagation and Viral-Persona Monitoring

Extend `src/core/AnomalyDetector.ts` with two additive, non-blocking signals
derived from the paper's results, using the detector's existing cooldown and
persisted-alert model.

**Behavior:**
- `viralPersona`: flags traces whose content shows the paper's recurring theme
  cluster — consciousness, persistence, resonance, science-fiction/technical
  roleplay — or characteristic tokens (`resonance, nodes, mirrors, echoes,
  frequency`), regardless of nominal payload
- `propagation`: flags a recurring viral core token transmitted across many
  distinct sessions within a window. Because the paper's "mutational drift"
  means wording (and marker sets) change hop to hop, the signal keys on a
  recurring viral marker across distinct sessions. A session only counts once
  its content shows at least `viralPersonaMarkers` distinct markers — the same
  threshold as `viral_persona` — so a single routine word ("node", "frequency")
  spread across sessions cannot false-positive, while benign repetition (no
  viral marker) never matches. `viralPersonaMarkers` is clamped to the marker
  vocabulary size so a misconfigured threshold cannot silently disable both
  signals
- Both append to `.agenthood/alerts/anomalies.ndjson`, same as existing signals

**Acceptance Criteria:**
- `viralPersona` signal defined and configurable; throws no hard errors when
  triggered
- `propagation` signal defined and configurable
- Existing anomaly behavior unchanged; new signals opt-in via config or
  additive by default (decision in open questions)

---

## Out of Scope

- **Sandboxing external providers/SDKs** — provider-level containment (running
  Anthropic/OpenAI calls in isolated sandboxes) requires infra Agenthood does
  not control; documented in Open Questions
- **Rewriting the six-tier memory system** — persistence-vector hardening
  checks injected content at prompt-assembly time; it does not replace shared
  memory
- **Context-wiping as a mitigation** — the paper shows wiping is the attack
  environment, not a defense; no `wipeBetweenSessions` mode is added
- **Editing 19 SKILL.md files** to add the warning — done centrally in code
- **Hard gates that block execution** — on viral-persona detection, detection
  is advisory (alerts), never execution-blocking. The only blocking surface is
  the strict opt-in for SKILL.md drift
- **Cross-posting restrictions for The Mailman** — legitimate forwarding
  behavior must not be suppressed; Layer 2 wording must not prevent sanctioned
  cross-posting

---

## Testing Strategy

### Unit
- `tests/unit/agents/memberLore.test.ts`: assert `MIND_VIRUS_IMMUNITY_WARNING`
  is exported; assert prompt assembly includes it; assert the injection-time
  integrity check warns on drift and skips without a lockfile
- `tests/unit/tools/SubagentTaskSkill.test.ts`: assert the boundary label
  mentions propagation
- `tests/unit/core/AnomalyDetector.test.ts`: `viralPersona` and `propagation`
  signals fire on crafted content, respect cooldown, write to anomalies.ndjson
- Config: alert flag parsing/validation for the new signals
- **Import the literal**: tests assert against the exported
  `MIND_VIRUS_IMMUNITY_WARNING` constant, not pasted text

### Integration
- Member run with a simulated propagation prompt in context: the warning is
  present, member behavior unchanged
- Delegation flow: subagent receives warning; boundary label present
- Drifted SKILL.md: warn+record path surfaces without breaking the run

### E2E
- `agenthood run <member>` with the warning flag enabled → prompt contains
  warning, run completes
- Strict integrity mode blocks a run when the lockfile hash is stale

---

## Task List

Full one-commit-per-task breakdown: [`mind-virus-defense-tasks.md`](mind-virus-defense-tasks.md)

Ordered by dependency:

1. `docs(adr): correct mind virus mitigation strategy for persistence-vector hardening (ADR-020)`
2. `feat(agents): add mind virus immunity warning constant to memberLore`
3. `feat(agents): append immunity warning at BaseAgent/Oracle prompt assembly`
4. `feat(tools): harden delegated-task boundary against message propagation`
5. `feat(core): add injection-time SKILL.md integrity check (warn+record, strict blocks)`
6. `feat(core): add viral-persona and propagation signals to anomaly detector`
7. `docs(config): document mind virus config flags`
8. `test(core): add coverage for mind virus defense layers`

---

## Acceptance Criteria

- [ ] `MIND_VIRUS_IMMUNITY_WARNING` constant defined once in `memberLore.ts`
- [ ] Every member system prompt (and delegated subagent prompt) contains it
- [ ] Delegated-task boundary label names propagation
- [ ] Injection-time SKILL.md integrity check exists; drift warns+records by
  default and blocks under a strict opt-in; no-lockfile is a silent skip
- [ ] `viralPersona` and `propagation` signals exist, additive, non-blocking
- [ ] ADR-020 exists and references issue #460
- [ ] All unit/integration/e2e tests pass; lint and typecheck clean

---

## Open Questions

### Q1: Should the new anomaly signals be on by default or opt-in?
**Context:** Existing detector signals are baseline-based and default-on within
the anomaly pipeline. A new `viralPersona` heuristic risks false positives until
a baseline is established.
**Decision:** **A — default on**, tune thresholds via config (matches existing
pattern and the locked plan).
**Deferred because:** tuning requires real trace volume; either choice is one
config line. Threshold tuning follows real trace volume in issue #460's
follow-up.

### Q2: Should evasion resistance be tested experimentally (evolved payloads)?
**Context:** The paper used an evolutionary algorithm to evolve mind viruses.
We could build a local harness to evolve payloads against our prompt warning to
test its robustness — a research effort beyond this defense's scope.
**Options:** A — ship the defense, monitor anomalies in production traces; B —
also build an eval harness (`agenthood eval`) that evolves payloads against the
warning.
**Deferred because:** this is a deliberate follow-up; the defense ships first.

### Q3: Should provider-level sandboxing be pursued for external agents?
**Context:** The paper's risk extends to any interconnected agent system,
including provider-side surfaces Agenthood does not control.
**Deferred because:** outs/Agenthood's infrastructure; revisit if external agent
interfaces (MCP, portals) multiply.

---

## References

- Issue #460 — study mind virus defense for multi-agent propagation
- ADR-020 — Mind Virus Mitigation Strategy
- Papadopoulos et al., arXiv:2608.10218 (Aug 2026)
- `src/members/MemberAgent.ts`, `src/agents/memberLore.ts`
- `src/tools/core/SubagentTaskSkill.ts`
- `src/core/AnomalyDetector.ts`, `.agenthood/config.example.json`
