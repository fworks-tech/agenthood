import type { TraceEnvelope, Tracer as TracerInterface } from "./types.ts"
import type { TraceStore } from "./TraceStore.ts"
import type { RedactionFilter } from "./RedactionFilter.ts"

/**
 * Central in-memory trace recorder. Holds a ring buffer of the most recent
 * envelopes (newest first on retrieval) and preserves the span API.
 * When a store is provided, envelopes are flushed to it on a configurable
 * cadence (the timer is unref'd so it never keeps the process alive).
 */
export class Tracer implements TracerInterface {
  private readonly buffer: Array<TraceEnvelope | undefined>
  private head = 0
  private size = 0
  private pending: TraceEnvelope[] = []

  constructor(
    readonly capacity = 1000,
    private readonly store?: TraceStore,
    private readonly flushIntervalMs = 5000,
    private readonly redactor?: RedactionFilter,
  ) {
    this.buffer = new Array<TraceEnvelope | undefined>(capacity)
    if (store) {
      const timer = setInterval(() => {
        this.flush().catch((err) => {
          console.error(`[Tracer] trace flush failed: ${err instanceof Error ? err.message : String(err)}`)
        })
      }, flushIntervalMs)
      timer.unref()
    }
  }

  startSpan(_name: string): void {}

  endSpan(_name: string, _data?: Record<string, unknown>): void {}

  record(envelope: TraceEnvelope): void {
    const stored = this.redactor ? this.redactor.redact(envelope) : envelope
    this.buffer[this.head] = stored
    this.head = (this.head + 1) % this.capacity
    if (this.size < this.capacity) this.size++
    if (this.store) this.pending.push(stored)
  }

  /** Flushes all pending envelopes to the configured store. On failure the failed envelope and the rest of the batch are re-queued for the next attempt. */
  async flush(): Promise<void> {
    if (!this.store || this.pending.length === 0) return
    const batch = this.pending.splice(0)
    for (let i = 0; i < batch.length; i++) {
      try {
        await this.store.store(batch[i])
      } catch (err) {
        this.pending.unshift(...batch.slice(i))
        throw err
      }
    }
  }

  getRecent(n: number): TraceEnvelope[] {
    const count = Math.min(Math.max(n, 0), this.size)
    const result: TraceEnvelope[] = []
    for (let i = 0; i < count; i++) {
      const idx = (this.head - 1 - i + this.capacity) % this.capacity
      const env = this.buffer[idx]
      if (env) result.push(env)
    }
    return result
  }

  getByMember(memberId: string): TraceEnvelope[] {
    return this.getRecent(this.size).filter((env) => env.member === memberId)
  }

  getByCorrelationId(id: string): TraceEnvelope[] {
    return this.getRecent(this.size).filter((env) => env.correlationId === id)
  }
}
