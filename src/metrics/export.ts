import { MetricsCollector } from '../memory/MetricsCollector.ts'
import type { MetricsEntry } from '../memory/MetricsCollector.ts'
import { readCosts } from '../core/CostLogger.ts'

export interface CostRollup {
  provider: string
  costUsd: number
  tokens: number
}

export interface MetricsSnapshot {
  members: MetricsEntry[]
  costs: CostRollup[]
  totalCostUsd: number
  totalTokens: number
}

/** Reads the local metrics and cost ledgers into one snapshot. Local-only
 *  source of truth — the exporters only re-shape it, never collect remotely. */
export function collectSnapshot(cwd: string): MetricsSnapshot {
  const members = new MetricsCollector(`${cwd}/.agenthood/metrics`).getAllStats()
  const byProvider = new Map<string, CostRollup>()

  for (const entry of readCosts(cwd)) {
    const row = byProvider.get(entry.provider) ?? { provider: entry.provider, costUsd: 0, tokens: 0 }
    row.costUsd += entry.costUsd
    row.tokens += entry.totalTokens
    byProvider.set(entry.provider, row)
  }

  const costs = [...byProvider.values()].sort((a, b) => a.provider.localeCompare(b.provider))
  return {
    members,
    costs,
    totalCostUsd: costs.reduce((sum, c) => sum + c.costUsd, 0),
    totalTokens: costs.reduce((sum, c) => sum + c.tokens, 0),
  }
}

/** Escape a Prometheus label value per the exposition format. */
function labelValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n')
}

function metric(name: string, help: string, type: 'counter' | 'gauge', samples: string[]): string {
  if (samples.length === 0) return ''
  return [`# HELP ${name} ${help}`, `# TYPE ${name} ${type}`, ...samples].join('\n')
}

/**
 * Renders the snapshot as Prometheus text exposition format (pull model: the
 * snapshot is read at scrape time, so there is no push path to keep in sync).
 */
export function renderPrometheus(snapshot: MetricsSnapshot): string {
  const lines: string[] = []

  const invocationSamples = snapshot.members.map(
    (m) => `agenthood_member_invocations_total{member="${labelValue(m.member)}"} ${m.metrics.invocations}`,
  )
  lines.push(metric('agenthood_member_invocations_total', 'Member invocations recorded.', 'counter', invocationSamples))

  const failureSamples = snapshot.members.map(
    (m) => `agenthood_member_failures_total{member="${labelValue(m.member)}"} ${m.metrics.failures}`,
  )
  lines.push(metric('agenthood_member_failures_total', 'Member invocations that failed.', 'counter', failureSamples))

  const successSamples = snapshot.members.map((m) => {
    const rate = m.metrics.invocations > 0 ? m.metrics.successes / m.metrics.invocations : 0
    return `agenthood_member_success_rate{member="${labelValue(m.member)}"} ${rate.toFixed(6)}`
  })
  lines.push(metric('agenthood_member_success_rate', 'Success ratio per member, 0-1.', 'gauge', successSamples))

  const durationSamples = snapshot.members.map((m) => {
    const avg = m.metrics.invocations > 0 ? m.metrics.totalDurationMs / m.metrics.invocations : 0
    return `agenthood_member_duration_ms_avg{member="${labelValue(m.member)}"} ${avg.toFixed(3)}`
  })
  lines.push(metric('agenthood_member_duration_ms_avg', 'Mean member run latency in milliseconds.', 'gauge', durationSamples))

  const costSamples = snapshot.costs.map(
    (c) => `agenthood_provider_cost_usd_total{provider="${labelValue(c.provider)}"} ${c.costUsd.toFixed(8)}`,
  )
  lines.push(metric('agenthood_provider_cost_usd_total', 'Cumulative estimated cost per provider, USD.', 'counter', costSamples))

  const tokenSamples = snapshot.costs.map(
    (c) => `agenthood_provider_tokens_total{provider="${labelValue(c.provider)}"} ${c.tokens}`,
  )
  lines.push(metric('agenthood_provider_tokens_total', 'Cumulative tokens per provider.', 'counter', tokenSamples))

  if (snapshot.totalCostUsd > 0) {
    lines.push(metric('agenthood_cost_usd_total', 'Cumulative estimated cost, USD.', 'counter', [
      `agenthood_cost_usd_total ${snapshot.totalCostUsd.toFixed(8)}`,
    ]))
  }
  if (snapshot.totalTokens > 0) {
    lines.push(metric('agenthood_tokens_total', 'Cumulative tokens.', 'counter', [
      `agenthood_tokens_total ${snapshot.totalTokens}`,
    ]))
  }

  const body = lines.filter(Boolean).join('\n')
  return body ? body + '\n' : ''
}

/** Renders the snapshot as StatsD datagram lines (one metric per line). */
export function renderStatsD(snapshot: MetricsSnapshot): string[] {
  const datagrams: string[] = []
  for (const m of snapshot.members) {
    const name = m.member.replace(/[^a-zA-Z0-9_.-]/g, '_')
    datagrams.push(`agenthood.member.${name}.invocations:${m.metrics.invocations}|c`)
    datagrams.push(`agenthood.member.${name}.failures:${m.metrics.failures}|c`)
    datagrams.push(`agenthood.member.${name}.success_rate:${(m.metrics.invocations > 0 ? m.metrics.successes / m.metrics.invocations : 0).toFixed(6)}|g`)
    datagrams.push(`agenthood.member.${name}.duration_ms_avg:${(m.metrics.invocations > 0 ? m.metrics.totalDurationMs / m.metrics.invocations : 0).toFixed(3)}|g`)
  }
  for (const c of snapshot.costs) {
    const name = c.provider.replace(/[^a-zA-Z0-9_.-]/g, '_')
    datagrams.push(`agenthood.provider.${name}.cost_usd_total:${c.costUsd.toFixed(8)}|c`)
    datagrams.push(`agenthood.provider.${name}.tokens_total:${c.tokens}|c`)
  }
  if (snapshot.totalCostUsd > 0) datagrams.push(`agenthood.cost_usd_total:${snapshot.totalCostUsd.toFixed(8)}|c`)
  if (snapshot.totalTokens > 0) datagrams.push(`agenthood.tokens_total:${snapshot.totalTokens}|c`)
  return datagrams
}
