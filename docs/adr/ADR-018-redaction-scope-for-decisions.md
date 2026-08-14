# ADR-018: Redaction Scope Extended to Decision and Provenance Payloads

**Date:** 2026-08-14
**Status:** Accepted

## Context

Issue #305 shipped redaction for trace envelopes: `Tracer.record` runs the
`RedactionFilter` over `envelope.input`/`envelope.output` before persistence,
so `.agenthood/traces/traces.ndjson` never contains raw PII or secrets. The
M7 audit that preceded this work found the guarantee was only half-true:
`BaseAgent.recordRun` persists the **raw** input and output — unredacted —
into `DecisionLog` files (`.agenthood/decisions/*.json`) and into the
ProvenanceStore chain. The same audit found a second integrity wart:
`createTraceEnvelope` hashed the raw input/output while `Tracer.record`
rewrote the payload redacted, so `inputHash` never matched the persisted
text — a verifier comparing hash to payload would always fail.

## Decision

1. **One redactor, one boundary.** The `RedactionFilter` instance built by
   `ApplicationContext` is now exposed on `ExecutionContext.redactor`, and
   `BaseAgent` runs every payload through it at the single source: trace
   envelope content, decision `task`/`decision`, and provenance
   `sourceDocument`. Decision/provenance persistence is no longer a bypass
   path for PII.
2. **Redact before hashing.** `recordTrace` redacts input/output *before*
   calling `createTraceEnvelope`, so `inputHash`/`outputHash` are computed
   over the exact text that is persisted. `Tracer.record`'s own pass remains
   as a safety net for other recorders; it is idempotent on already-redacted
   text (placeholders match no rules).
3. **Opt-in semantics unchanged.** Redaction still applies only when
   `observability.redaction.enabled` is true; disabled installs see no
   behavioral change.

## Alternatives Considered

| Option | Pros | Cons | Why Rejected |
|--------|------|------|-------------|
| Keep decisions raw, document the bypass | No provenance-semantics change | Defeats the redaction feature's purpose for the majority of persisted text | Security-correctness wins |
| Redact only at persist time (in DecisionLog/ProvenanceStore) | Central choke point | Two redaction points with divergent rule sets; store layer shouldn't know about config | Single shared redactor at the source is simpler and deterministic |
| Hash the redacted payload only in the store | Fixes integrity without touching envelope creation | Hash is part of the envelope contract; diverging hashers across callers | Redact-before-hash fixes all callers uniformly |

## Consequences

- Decisions, provenance, and traces now carry consistent redacted content;
  `DecisionSearch`/`DecisionLog.search` index the redacted text, which is
  the intended trade-off for replayable, PII-safe stores.
- Hash integrity: any tool comparing `inputHash` to persisted `input` now
  verifies cleanly.
- Behavior change is visible only when redaction is enabled; the default
  (disabled) config is untouched.
