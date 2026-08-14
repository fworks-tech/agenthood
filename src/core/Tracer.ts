import type { TraceEnvelope, Tracer as TracerInterface } from "./types.ts"

/**
 * Central in-memory trace recorder. Holds a ring buffer of the most recent
 * envelopes (newest first on retrieval) and preserves the span API.
 */
export class Tracer implements TracerInterface {
  private readonly buffer: Array<TraceEnvelope | undefined>
  private head = 0
  private size = 0

  constructor(readonly capacity = 1000) {
    this.buffer = new Array<TraceEnvelope | undefined>(capacity)
  }

  startSpan(_name: string): void {}

  endSpan(_name: string, _data?: Record<string, unknown>): void {}

  record(envelope: TraceEnvelope): void {
    this.buffer[this.head] = envelope
    this.head = (this.head + 1) % this.capacity
    if (this.size < this.capacity) this.size++
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
