# ADR-034: Per-Step Trajectory

**Date:** 2026-11-15
**Status:** Accepted

## Context

Trajectories stored a single summary step: the task in, the final output out,
one cost and one duration. `trace visualize` rendered a one-box timeline for a
run that may have taken thirty turns, so the audit trail answered "what
happened" with "something".

The ReAct loop already knows each turn: model, tokens, tools called, activated
skills, but only emitted it as an event.

## Decision

The loop records a `TrajectoryStep` per turn and `MemberRunner` persists them.

- A step carries the model, token counts, cost, status, the active skills, and
  every tool call with its redacted input and output.
- Redaction reuses `redactEventText`; there is no second redaction path, and
  payloads are capped at 500/2000 characters.
- Tool calls are an array on the step rather than one tool per step, because a
  turn can call several tools and splitting it would double-count tokens.
- Legacy fields (`tool`, `toolInput`, `toolOutput`) stay optional and are still
  read, so old trajectory files render unchanged.
- `trace --skill` and `trace --tool` list the trajectories whose steps match,
  and `trace visualize` prints real steps, tools and skills.

## Consequences

- Trajectory files grow with the run; they are per-run JSON, not a stream.
- Skill and tool attribution becomes queryable after the fact.
- Steps are recorded on success; a run that throws before a turn completes
  keeps the steps it finished.
