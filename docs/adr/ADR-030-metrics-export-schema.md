# ADR-030: Metrics Export Schema and Privacy Boundary

**Date:** 2026-09-25
**Status:** Accepted

## Context

`MetricsCollector` and `CostLogger` already accumulate exactly what an operator
wants to alert on — invocations, failures, latency, tokens, cost per provider — but
only as local JSON for a human running `agenthood status`. Teams monitoring agent
usage, spend, and error rates have no way to get that into Prometheus, Grafana,
Datadog, or a StatsD collector without hand-writing a parser over
`.agenthood/metrics/*.json` and `costs.jsonl`.

Two constraints shaped the decision:

1. **The ledgers can hold sensitive text.** `costs.jsonl` rows sit next to
   `traces.ndjson`, which does carry task and tool-output text. Redaction
   (ADR-020's `observability.redaction`) covers persisted *traces*, not the metrics
   directory, so an exporter must not become a side channel around it.
2. **A metric that is silently absent is worse than one that is wrong.** An
   exporter that fails open — starts, reports nothing, exits 0 — is indistinguishable
   from an agent that is not being used.

## Decision

Export is **opt-in, local-source, and redaction-safe by construction**.

**Config.** A single `metricsExport` section drives everything:

```json
{ "metricsExport": { "type": "none" | "prometheus" | "statsd", "port": 9464, "host": "127.0.0.1" } }
```

Default is `none`. An unrecognized `type` is a hard user error, not a no-op — a
monitoring setup you believe is on but is not is a silent failure.

**Privacy boundary.** The exporters read only two structures: counter fields in
`MetricsCollector` and `CostEntry`. They emit member names, provider names, and
numbers. No task text, no tool output, no prompts, no file paths ever cross the
boundary. This is a structural property — the renderers take counters, not records —
so it cannot be undone by a future field addition the way a redaction regex list can.

**Prometheus over push.** `agenthood metrics` with `type: 'prometheus'` serves
`/metrics` in text exposition format, rendering the snapshot **on each scrape** from
the local ledgers. This deliberately diverges from the issue's "export on each
collection": the pull model means there is no push buffer, no flush point, and no
window in which the endpoint serves a number the ledgers disagree with. Standard
Prometheus scrapers expect a pull endpoint, and every StatsD/Datadog path can still
read from it. The server runs only while the command runs — nothing is spawned
during `agenthood run`, so a normal member run still exits.

**Metric names** follow the `agenthood_<subject>_<unit>` convention:

| Metric | Type | Labels |
|---|---|---|
| `agenthood_member_invocations_total` | counter | `member` |
| `agenthood_member_failures_total` | counter | `member` |
| `agenthood_member_success_rate` | gauge | `member` |
| `agenthood_member_duration_ms_avg` | gauge | `member` |
| `agenthood_provider_cost_usd_total` | counter | `provider` |
| `agenthood_provider_tokens_total` | counter | `provider` |
| `agenthood_cost_usd_total` | counter | — |
| `agenthood_tokens_total` | counter | — |

Ratios are gauges, not counters: `success_rate` is a computed mean, and a
monotonically increasing "rate" would be read as a rising failure count.
Per-provider series are omitted entirely when no data exists, rather than emitted
as a zero, so a fresh install does not look like a fleet of idle providers.

**StatsD is push.** `type: 'statsd'` sends one fire-and-forget UDP datagram per
metric after each member run, from the single `finally` block in `MemberRunner`
so success, failure, and parked runs all publish. No retry, no batching, no queue:
a monitoring packet that needs resending is not worth a buffer, and export must never
be able to fail a member run. A malformed config is reported by `agenthood metrics`,
not by every run.

## Alternatives Considered

| Option | Pros | Cons | Why Rejected |
|--------|------|------|-------------|
| Push on each collection (as the issue proposed) | no scrape latency | needs a push path, flush points, and a buffer; can serve numbers the ledgers disagree with | Rejected in favor of scrape-time render |
| Start the exporter during `agenthood run` | no separate process | a long-lived server prevents the run from exiting; port conflicts on every concurrent run | Rejected |
| Export raw records (task text, tool output) | full-fidelity dashboards | bypasses `observability.redaction`; leaks task content to third parties | Rejected |
| Default `metricsExport.type` to `prometheus` | zero-config dashboards | opens a listening socket in every project by default | Rejected; opt-in is the privacy-safe default |
| Unknown `type` falls back to `none` | never breaks a run | monitoring silently off while the config claims it is on | Rejected; hard error instead |
| Batched StatsD with retry/aggregation | fewer datagrams, delivery guarantees | queue, timers, and failure modes for data that is a monitoring hint | Rejected |

## Consequences

Easier: teams get cost, token, latency, and success-rate series into their existing
stack with `metricsExport.type` and no custom code; the renderers are pure functions
over counters, so the schema is testable without a network or a running agent;
`agenthood metrics --print` renders one snapshot for debugging. Harder: a pull
endpoint is only as fresh as its scrape interval, and StatsD push is
best-effort — a monitor that requires guaranteed delivery needs a different
transport. Adding a new metric means adding a row to the table above and one
renderer line, and the label set is deliberately narrow to bound cardinality.

## References

- `src/metrics/export.ts` (`collectSnapshot`, `renderPrometheus`, `renderStatsD`)
- `src/metrics/server.ts`, `src/metrics/statsd.ts`, `src/metrics/config.ts`
- `src/commands/metrics.ts`, `src/runtime/MemberRunner.ts` (export hook)
- Issue #651; ADR-020 (redaction), ADR-029 (fail-closed trust)
