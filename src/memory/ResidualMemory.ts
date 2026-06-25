import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

export interface TraceSignal {
  id: string
  pattern: string
  strength: number
  lastReinforced: Date
  decayRate: number
}

export interface ResidualMemoryOptions {
  filePath?: string
  defaultDecayRate?: number
}

export class ResidualMemory {
  private signals: Map<string, TraceSignal> = new Map()
  private filePath?: string
  private defaultDecayRate: number

  constructor(options: ResidualMemoryOptions = {}) {
    this.filePath = options.filePath
    this.defaultDecayRate = options.defaultDecayRate ?? 0.9
    if (this.filePath && existsSync(this.filePath)) {
      this.load(this.filePath)
    }
  }

  record(pattern: string, strength: number): void {
    const existing = this.findByPattern(pattern)
    if (existing) {
      existing.strength = Math.min(1.0, existing.strength + strength)
      existing.lastReinforced = new Date()
    } else {
      const id = `trace_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
      this.signals.set(id, {
        id,
        pattern,
        strength: Math.min(strength, 1.0),
        lastReinforced: new Date(),
        decayRate: this.defaultDecayRate,
      })
    }
    this.maybeSave()
  }

  decay(): void {
    const now = Date.now()
    for (const signal of this.signals.values()) {
      const daysElapsed = (now - signal.lastReinforced.getTime()) / (1000 * 60 * 60 * 24)
      if (daysElapsed > 0) {
        signal.strength *= Math.pow(signal.decayRate, daysElapsed)
      }
    }
  }

  getActive(threshold: number = 0.3): TraceSignal[] {
    this.pruneBelow(0.1)
    return Array.from(this.signals.values())
      .filter((s) => s.strength > threshold)
      .sort((a, b) => b.strength - a.strength)
  }

  toPromptHints(maxHints: number = 10, maxLength: number = 500): string {
    const active = this.getActive()
    if (active.length === 0) return ''
    const hints: string[] = []
    let totalLen = 0
    for (const s of active.slice(0, maxHints)) {
      const line = `- ${s.pattern} (confidence: ${s.strength.toFixed(2)})`
      if (totalLen + line.length + 1 > maxLength) break
      hints.push(line)
      totalLen += line.length + 1
    }
    return `Residual memory traces:\n${hints.join('\n')}`
  }

  save(filePath: string): void {
    const dir = dirname(filePath)
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true })
    }
    const data = Array.from(this.signals.values()).map((s) => ({
      ...s,
      lastReinforced: s.lastReinforced.toISOString(),
    }))
    writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8')
  }

  load(filePath: string): void {
    if (!existsSync(filePath)) return
    const raw = readFileSync(filePath, 'utf8')
    const data: Array<Omit<TraceSignal, 'lastReinforced'> & { lastReinforced: string }> =
      JSON.parse(raw)
    this.signals.clear()
    for (const item of data) {
      this.signals.set(item.id, {
        ...item,
        lastReinforced: new Date(item.lastReinforced),
      })
    }
  }

  clear(): void {
    this.signals.clear()
    if (this.filePath && existsSync(this.filePath)) {
      writeFileSync(this.filePath, JSON.stringify([]), 'utf8')
    }
  }

  count(): number {
    return this.signals.size
  }

  private findByPattern(pattern: string): TraceSignal | undefined {
    for (const signal of this.signals.values()) {
      if (signal.pattern === pattern) return signal
    }
    return undefined
  }

  private pruneBelow(threshold: number): void {
    for (const [id, signal] of this.signals) {
      if (signal.strength < threshold) {
        this.signals.delete(id)
      }
    }
  }

  private maybeSave(): void {
    if (this.filePath) {
      this.save(this.filePath)
    }
  }
}
