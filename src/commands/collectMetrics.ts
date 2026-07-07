import { MetricsCollector } from '../memory/MetricsCollector.js'
import type { MetricsEntry } from '../memory/MetricsCollector.js'

export function collectMemberMetrics(metricsDir: string): MetricsEntry[] {
  return new MetricsCollector(metricsDir).getAllStats()
}
