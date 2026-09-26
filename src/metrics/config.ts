import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { pushStatsD } from './statsd.ts'

export type MetricsExportType = 'prometheus' | 'statsd' | 'none'

export interface MetricsExportConfig {
  type: MetricsExportType
  port: number
  host: string
}

export const DISABLED_METRICS_EXPORT: MetricsExportConfig = { type: 'none', port: 9464, host: '127.0.0.1' }

/** Resolves `metricsExport` from `.agenthood/config.json`. An unknown type is
 *  a user error, not a silent no-op — a metrics export you think is on but
 *  is not is worse than a refusal. */
export function loadMetricsExportConfig(cwd: string): MetricsExportConfig {
  const configPath = join(cwd, '.agenthood', 'config.json')
  if (!existsSync(configPath)) return DISABLED_METRICS_EXPORT
  let raw: unknown
  try {
    raw = JSON.parse(readFileSync(configPath, 'utf8'))
  } catch {
    return DISABLED_METRICS_EXPORT
  }
  const section = (raw as { metricsExport?: Record<string, unknown> } | null)?.metricsExport
  if (!section || typeof section !== 'object') return DISABLED_METRICS_EXPORT

  const type = section.type
  if (type !== 'prometheus' && type !== 'statsd' && type !== 'none') {
    throw new Error(`metricsExport.type must be 'prometheus' | 'statsd' | 'none', got ${JSON.stringify(type)}`)
  }
  return {
    type,
    port: typeof section.port === 'number' ? section.port : 9464,
    host: typeof section.host === 'string' && section.host ? section.host : '127.0.0.1',
  }
}

/** Pushes a snapshot when StatsD export is enabled. No-op otherwise, and
 *  never throws — export must not be able to fail a member run. */
export function exportIfConfigured(cwd: string): void {
  try {
    const config = loadMetricsExportConfig(cwd)
    if (config.type === 'statsd') pushStatsD(cwd, { host: config.host, port: config.port })
  } catch {
    // a bad config is reported by `agenthood metrics`, not by every run
  }
}
