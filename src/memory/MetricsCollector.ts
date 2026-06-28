import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

export interface MemberMetrics {
  invocations: number
  successes: number
  failures: number
  totalDurationMs: number
  lastRun: string | null
}

export interface MetricsEntry {
  member: string
  metrics: MemberMetrics
}

export class MetricsCollector {
  private metricsDir: string

  constructor(metricsDir: string) {
    this.metricsDir = metricsDir
  }

  record(member: string, success: boolean, durationMs: number): void {
    const path = join(this.metricsDir, `${member}.json`)
    let metrics: MemberMetrics

    if (existsSync(path)) {
      try {
        metrics = JSON.parse(readFileSync(path, 'utf8'))
      } catch {
        metrics = this.emptyMetrics()
      }
    } else {
      metrics = this.emptyMetrics()
    }

    metrics.invocations++
    if (success) {
      metrics.successes++
    } else {
      metrics.failures++
    }
    metrics.totalDurationMs += durationMs
    metrics.lastRun = new Date().toISOString()

    if (!existsSync(this.metricsDir)) {
      mkdirSync(this.metricsDir, { recursive: true })
    }
    writeFileSync(path, JSON.stringify(metrics, null, 2) + '\n', 'utf8')
  }

  getStats(member: string): MemberMetrics | null {
    const path = join(this.metricsDir, `${member}.json`)
    if (!existsSync(path)) return null
    try {
      return JSON.parse(readFileSync(path, 'utf8'))
    } catch {
      return null
    }
  }

  getAllStats(): MetricsEntry[] {
    if (!existsSync(this.metricsDir)) return []
    try {
      const files = readdirSync(this.metricsDir).filter((f) => f.endsWith('.json'))
      const entries: MetricsEntry[] = []
      for (const file of files) {
        const member = file.replace(/\.json$/, '')
        const metrics = this.getStats(member)
        if (metrics) entries.push({ member, metrics })
      }
      return entries.sort((a, b) => b.metrics.invocations - a.metrics.invocations)
    } catch {
      return []
    }
  }

  getStaleMembers(maxDays: number): MetricsEntry[] {
    const all = this.getAllStats()
    const cutoff = Date.now() - maxDays * 24 * 60 * 60 * 1000
    return all.filter((e) => {
      if (!e.metrics.lastRun) return true
      return new Date(e.metrics.lastRun).getTime() < cutoff
    })
  }

  getSuccessRate(member: string): number | null {
    const metrics = this.getStats(member)
    if (!metrics || metrics.invocations === 0) return null
    return metrics.successes / metrics.invocations
  }

  getAverageDuration(member: string): number | null {
    const metrics = this.getStats(member)
    if (!metrics || metrics.invocations === 0) return null
    return Math.round(metrics.totalDurationMs / metrics.invocations)
  }

  clear(member: string): void {
    const path = join(this.metricsDir, `${member}.json`)
    if (existsSync(path)) {
      writeFileSync(path, JSON.stringify(this.emptyMetrics(), null, 2) + '\n', 'utf8')
    }
  }

  private emptyMetrics(): MemberMetrics {
    return { invocations: 0, successes: 0, failures: 0, totalDurationMs: 0, lastRun: null }
  }
}
