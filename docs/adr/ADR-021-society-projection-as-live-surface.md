# ADR-021: Society Projection as a Live Surface

**Date:** 2026-08-21
**Status:** Accepted

## Context

The Society's runtime already records everything worth knowing about how work actually happens. Every member invocation is wrapped in governance: the Doorman gates entry, the Reviewer gates merge, the Auditor clears security-sensitive changes, the Warden patrols for decay, the Scribe narrates the diff, the Operator shepherds it to production, and the Mailman delivers the signal. Each of these is a node with a pass/fail outcome, and each carries provenance — who was invoked, with what task, what decision was recorded, what evidence chain links it to the previous step.

For a long time this delegation graph existed only as a *manual artifact* — diagrams drawn by hand to explain how the Society routes work. A human would sketch `doorman → reviewer → auditor → warden → scribe → operator → mailman` with arrows and gate checks, and present it as documentation of the *intended* flow. The problem: that diagram describes the architecture we aspired to, not the architecture we actually executed. It was static. It went stale the moment a run deviated, skipped a gate, or failed upstream. And crucially, it described a *plan* rather than an *occurrence*.

The realization, stated plainly: **that delegation diagram IS the product.** It is not a documentation byproduct of the runtime — it is the most valuable rendering of the runtime's behavior. A live UI that shows, per run, each member node lighting up in sequence, each pass/fail gate resolving, and the provenance chain threading between decisions, is *exactly* the surface a human operator wants to watch. It tells them, in real time, what the Society is doing and why.

The good news is that none of this data is new or hypothetical. It already exists and already streams. ADR-015 established the decision-intelligence and provenance layer: every run records one decision and one provenance entry (success or failure) with tamper-evident hash-chain integrity and causal links between decisions. ADR-020 extended this layer. The `RunEventBus` (issue #474) exposes a live, in-process event stream of exactly the events a renderer needs — `run.started`, `reasoning`, `tool.called`, `tool.result`, `decision.recorded`, `provenance.recorded`, `run.finished`, `run.failed`. Persisted `ProvenanceStore` writes the tamper-evident chain, `DecisionLog` maintains `edges.json` (the causal graph edges between decisions — `CAUSED`, `INFLUENCED`, `PRECEDENT_FOR`), and `GraphSnapshot` captures the structural state of the graph. Everything the visualizer needs is already being produced; nothing needs to be invented.

What is missing is a *contract*. The data exists across several mechanisms (a live in-process bus and several persistence formats) with no single, stable, read-only shape that an external consumer can depend on. Without a contract, every visualizer reinvents the integration, couples to internals, and breaks whenever the persistence layer changes. The gap is not data — it is commitment.

## Decision

The Society's provenance / decision / event layer becomes a first-class, **read-only projection contract** that external visualizers subscribe to. The layer does not expose its internal write path; instead it publishes an agreed, versioned, read-only projection of the run state — the delegation graph with node outcomes, gate results, and provenance chains — and treats that projection as a stable public API.

Key properties of the contract:

- **Read-only.** Visualizers consume; they never mutate Society state through it. Writes stay behind the runtime's existing mechanisms.
- **A single projection contract.** One shaped, versioned surface (not a loose bouquet of internal event types and file formats). Consumers bind to the projection, not to `RunEventBus` internals or persistence file layouts.
- **Live and replayable.** The projection is served from the live `RunEventBus` stream (issue #474) for real-time rendering, and can be replayed from persisted `ProvenanceStore` / `DecisionLog` `edges.json` / `GraphSnapshot` (ADR-015) for historical views. Same shape, two sources of truth reconciled by the contract.
- **External visualizers subscribe.** The contract is explicitly designed so systems outside the runtime — dashboards, browsers, auditors — can render the delegation graph without reaching into the codebase.

**Atlaslink is the reference consumer.** Atlaslink consumes this projection contract as its first implementation, proving the surface is sufficient to render the live delegation diagram (`doorman → reviewer → auditor → warden → scribe → operator → mailman` with pass/fail gates and provenance at every node). Its needs define what the contract must expose; it is the canary that keeps the projection honest. Improving atlaslink's rendering is not a reason to widen the contract unless the gap is genuinely general.

The projection contract is deliberately **read-only by construction**: it is the read model of the run, decoupled from the write model, so that restructuring persistence (storage, retention, migration) never changes what a visualizer sees.

## Alternatives Considered

| Option | Pros | Cons | Why Rejected |
|--------|------|------|-------------|
| Ad-hoc: visualizers bind directly to `RunEventBus` types and persisted file formats | Fastest to start; no abstraction; atlaslink gets something working immediately | Couples every consumer to runtime internals; breaks on any internal refactor; no versioning; every visualizer reinvents integration | The exact gap the ADR identifies. No contract means no stable surface, and the projection dies on the first persistence change. |
| Build a bespoke visualizer API inside the agenthood runtime | Full control; tailored schema | Duplicates state; inflates runtime surface; couples render needs into core; single-consumer bias | A contract served *from* the existing event/provenance layer is enough — no need to grow the runtime's write path for it. |
| Projection contract with atlaslink as reference consumer (chosen) | Stable versioned read surface; live + replayable; decouples visualizers from internals; reference consumer proves sufficiency | Slight up-front contract design; must keep projection in sync with event stream | The only option that turns the existing streaming/persisted data into a dependable public surface without bloating the runtime. |

## Consequences

**Easier:**
- External visualizers (atlaslink dashboards, browsers, auditors) can render the delegation graph with a stable contract instead of reaching into internals.
- The live delegation diagram becomes a genuine rendering of *actual* executed runs — members lighting up, gates resolving pass/fail, provenance chains threading between decisions — rather than a hand-drawn plan that goes stale.
- Persistence can be restructured freely (storage, retention, migration) without breaking any consumer, because consumers bind to the read-only projection, not the storage layout.
- New consumers integrate once against a versioned surface instead of against several ad-hoc mechanisms.

**Harder:**
- The projection contract now carries a compatibility obligation — changes to it must be versioned and negotiated, not made silently.
- The projection must be kept in sync with the live `RunEventBus` stream and the persisted `ProvenanceStore` / `DecisionLog` / `GraphSnapshot`, which is an ongoing maintenance responsibility.

**New risks:**
- Contract drift — if the projection falls out of sync with the event stream, visualizers render stale or inaccurate graphs. This is the primary risk introduced and must be guarded by tests and a reconciliation check.
- Over-fitting the contract to atlaslink — because it is the reference consumer, there is pressure to widen the surface for atlaslink-only needs. The contract must stay general and versioned to resist that.

## References

- ADR-015: Decision Intelligence and Provenance (merged — provenance/decision layer, hash-chain integrity, causal links)
- ADR-020: Mind Virus Mitigation Strategy (extends the decision/provenance layer with integrity checking and hardening)
- Issue #474: Run event feed — `RunEventBus` live in-process event stream (8 event types: `run.started`, `reasoning`, `tool.called`, `tool.result`, `decision.recorded`, `provenance.recorded`, `run.finished`, `run.failed`)
- `RunEventBus.ts` — live event bus on `ApplicationContext` (`context.events.subscribe(handler)`)
- `ProvenanceStore.ts` — tamper-evident provenance chain (`.agenthood/provenance/*.json`)
- `DecisionLog.ts` — decision log persisted as `edges.json` (causal graph edges: `CAUSED`, `INFLUENCED`, `PRECEDENT_FOR`)
- `GraphSnapshot.ts` — structural snapshot of the graph (`.agenthood/snapshots/`)
- Atlaslink — reference consumer of the projection contract
