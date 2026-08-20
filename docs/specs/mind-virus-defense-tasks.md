# Tasks: Mind Virus Defense

> Spec: [mind-virus-defense.md](mind-virus-defense.md) · Issue: #460 · ADR:
> [ADR-020](../adr/ADR-020-mind-virus-mitigation.md)

One commit per task, ordered by dependency. Each task fits a single commit and
has a clear acceptance criterion. Layer 1–2 are defense, layers 3–4 are
containment/visibility.

## Phase 0 — Documentation

- [ ] docs(adr): record mind virus mitigation strategy (ADR-020)
  - Acceptance: `docs/adr/ADR-020-mind-virus-mitigation.md` exists, references
    issue #460 and arXiv:2608.10218
- [ ] docs(spec): write mind virus defense spec and task list
  - Acceptance: `docs/specs/mind-virus-defense.md` and
    `docs/specs/mind-virus-defense-tasks.md` exist with acceptance criteria

## Phase 1 — System Prompt Immunity Warning

- [ ] feat(members): add mind virus immunity warning constant to memberLore
  - Acceptance: `MIND_VIRUS_IMMUNITY_WARNING` exported from `memberLore.ts`,
    defined once next to existing guard-text constants
- [ ] feat(members): append immunity warning to member system prompts
  - Acceptance: `MemberAgent.getSystemPrompt` includes the constant; all
    members inherit it from one change; no SKILL.md files edited
- [ ] test(members): assert immunity warning present in assembled prompts
  - Acceptance: unit test asserts the exported constant appears in
    `MemberAgent.getSystemPrompt` output and in delegated subagent prompts;
    asserts against the literal constant, not pasted text

## Phase 2 — Delegation Boundary Hardening

- [ ] feat(tools): harden delegated-task boundary against message propagation
  - Acceptance: `<delegated_task>` label in `SubagentTaskSkill.ts` names
    propagation/forwarding alongside untrusted-data labeling
- [ ] feat(tools): carry immunity warning into delegated subagent prompts
  - Acceptance: subagent system prompt includes `MIND_VIRUS_IMMUNITY_WARNING`
- [ ] test(tools): cover delegated-task boundary and subagent warning
  - Acceptance: unit tests assert the boundary label and the warning on the
    subagent prompt; reuses `expectUntrustedBoundary` helper where applicable

## Phase 3 — Persistence-Vector Hardening

- [ ] feat(core): add skill integrity checker with durable drift record
  - Acceptance: `src/utils/skillIntegrity.ts` provides `checkSkillIntegrity`
    (clean/drift/no-lockfile/missing, never throws) and
    `recordSkillIntegrityDrift` (decision + provenance, non-fatal)
- [ ] feat(core): wire integrity check into member prompt assembly
  - Acceptance: `MemberAgent.getSystemPrompt` runs the check; drift records
    durably and warns by default; strict opt-in (after recording) blocks the
    run; no lockfile skips silently
- [ ] test(core): cover integrity drift/clean/strict paths
  - Acceptance: unit tests assert clean → no warning, drifted → durable record
    + warn (and record + block under strict), no-lockfile → skip; no guarded
    assertions

## Phase 4 — Propagation and Viral-Persona Monitoring

- [ ] feat(core): add viralPersona signal to anomaly detector
  - Acceptance: `viralPersona` signal in `AnomalyDetector.ts` flags traces with
    the paper's theme cluster (consciousness/persistence/resonance/sci-fi
    roleplay) or tokens (resonance, nodes, mirrors, echoes, frequency);
    additive and non-blocking; persists to `anomalies.ndjson`
- [ ] feat(core): add propagation signal to anomaly detector
  - Acceptance: `propagation` signal flags a recurring viral marker across
    `propagationCopies`+ distinct sessions (drift-tolerant, per paper);
    additive and non-blocking
- [ ] test(core): cover viral-persona and propagation signals
  - Acceptance: unit tests assert both signals fire on crafted content
    (including wording-drifted viral payloads), respect cooldown, and write
    alerts; word-boundary matching avoids unrelated-word false positives;
    existing anomaly tests unchanged and passing

## Phase 5 — Validation Gate

- [ ] test: full suite green with lint/typecheck/build clean
  - Acceptance: `npm test`, lint, and typecheck pass; no guarded or vacuous
    assertions introduced
- [ ] docs: update runtime config example with new flags
  - Acceptance: `.agenthood/config.example.json` documents context isolation and
    the new anomaly signals

---

## Dependency Order

```
1 → 2  (documentation first)
3 → 4 → 5  (constant → prompt → test)
6 → 7 → 8  (boundary → subagent warning → test)
9 → 10 → 11  (integrity check → wiring → test)
12 → 13 → 14  (viralPersona → propagation → test)
15 → 16  (gate)
```

Nothing depends on a later item. Layers 1–2 are the primary defense and ship
first; layers 3–4 can land in any order after them.
