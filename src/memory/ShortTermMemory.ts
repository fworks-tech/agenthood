export interface ShortTermMemoryEntry {
  content: string
  timestamp: Date
}

export class ShortTermMemoryImpl {
  private buffer: ShortTermMemoryEntry[] = []
  private capacity: number
  private ttlMs: number

  constructor(capacity: number = 20, ttlMs: number = Number.POSITIVE_INFINITY) {
    this.capacity = capacity
    this.ttlMs = ttlMs
  }

  add(message: string): void {
    this.buffer.push({ content: message, timestamp: new Date() })
    if (this.buffer.length > this.capacity) {
      this.buffer = this.buffer.slice(-this.capacity)
    }
  }

  getRecent(n: number): string[] {
    const cutoff = Date.now() - this.ttlMs
    return this.buffer.filter((e) => e.timestamp.getTime() >= cutoff).slice(-n).map((e) => e.content)
  }

  clear(): void {
    this.buffer = []
  }

  size(): number {
    return this.buffer.length
  }
}
