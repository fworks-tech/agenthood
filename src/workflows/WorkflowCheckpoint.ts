import type { WorkflowContext } from './types.js'

export interface Checkpoint {
  id: string
  stepName: string
  artifacts: Record<string, unknown>
  timestamp: Date
  sequence: number
}

export class WorkflowCheckpoint {
  private checkpoints: Map<string, Checkpoint> = new Map()
  private sequence: number = 0

  save(stepName: string, context: WorkflowContext): string {
    this.sequence++
    const id = `cp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const snapshot: Record<string, unknown> = {}
    for (const [key, value] of context.artifacts) {
      snapshot[key] = this.deepClone(value)
    }

    this.checkpoints.set(id, {
      id,
      stepName,
      artifacts: snapshot,
      timestamp: new Date(),
      sequence: this.sequence,
    })

    return id
  }

  restore(checkpointId: string, context: WorkflowContext): void {
    const checkpoint = this.checkpoints.get(checkpointId)
    if (!checkpoint) {
      throw new Error(`Checkpoint not found: "${checkpointId}"`)
    }

    context.artifacts.clear()
    for (const [key, value] of Object.entries(checkpoint.artifacts)) {
      context.artifacts.set(key, this.deepClone(value))
    }
  }

  clear(checkpointId: string): void {
    this.checkpoints.delete(checkpointId)
  }

  clearAll(): void {
    this.checkpoints.clear()
  }

  count(): number {
    return this.checkpoints.size
  }

  getLatest(): Checkpoint | undefined {
    const sorted = Array.from(this.checkpoints.values()).sort(
      (a, b) => b.sequence - a.sequence,
    )
    return sorted[0]
  }

  private deepClone<T>(value: T): T {
    if (value === null || value === undefined) return value
    if (typeof value !== 'object') return value
    return JSON.parse(JSON.stringify(value))
  }
}
