export interface ShortTermMemoryEntry {
  content: string
  timestamp: Date
}

export class ShortTermMemoryImpl {
  private buffer: ShortTermMemoryEntry[] = []
  private capacity: number

  constructor(capacity: number = 20) {
    this.capacity = capacity
  }

  add(message: string): void {
    this.buffer.push({ content: message, timestamp: new Date() })
    if (this.buffer.length > this.capacity) {
      this.buffer = this.buffer.slice(-this.capacity)
    }
  }

  getRecent(n: number): string[] {
    return this.buffer.slice(-n).map((e) => e.content)
  }

  clear(): void {
    this.buffer = []
  }

  size(): number {
    return this.buffer.length
  }
}
