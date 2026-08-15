import { MetricsCollector } from '../memory/MetricsCollector.ts'
import type { MetricsEntry } from '../memory/MetricsCollector.ts'

export function collectMemberMetrics(metricsDir: string): MetricsEntry[] {
  return new MetricsCollector(metricsDir).getAllStats()
}
