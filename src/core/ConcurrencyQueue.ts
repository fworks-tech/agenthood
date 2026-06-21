/**
 * src/core/ConcurrencyQueue.ts
 *
 * Priority queue manager for the Society. Ensures work is prioritised, slots
 * are respected, and no request starves.
 *
 * Implements architecture/concurrency-and-queues.md:
 * - Priority levels: USER (2), SCHEDULED (1), BACKGROUND (0)
 * - Configurable slots (default 3, max 10)
 * - Queue depth cap = 10× slots
 * - Starvation escalation at 60s
 * - USER-displacement when queue is full
 */

export type Priority = 'USER' | 'SCHEDULED' | 'BACKGROUND'

const PRIORITY_VALUE: Record<Priority, number> = {
  USER: 2,
  SCHEDULED: 1,
  BACKGROUND: 0,
}

export interface QueuedTask {
  id: string
  label: string
  priority: Priority
  priorityValue: number
  enqueuedAt: number
  execute: () => Promise<void>
}

export interface QueueStatus {
  running: number
  queued: number
  paused: number
  slotsTotal: number
}

export class ConcurrencyQueue {
  private queue: QueuedTask[] = []
  private running = 0
  private paused = 0
  private slotCount: number
  private readonly maxDepth: number
  private readonly starvationMs: number
  private timerId: ReturnType<typeof setInterval> | null = null

  constructor(
    slots: number = 3,
    starvationMs: number = 60_000,
  ) {
    if (slots < 1 || slots > 10) {
      throw new Error(`ConcurrencyQueue: slots must be between 1 and 10, got ${slots}`)
    }
    this.slotCount = slots
    this.maxDepth = slots * 10
    this.starvationMs = starvationMs
  }

  /**
   * Enqueue a task for execution. Returns true if the task was accepted,
   * false if it was rejected (BACKGROUND when queue full).
   *
   * Throws if the queue is full and the request cannot be admitted even
   * via displacement.
   */
  enqueue(task: QueuedTask): boolean {
    const depth = this.queue.length

    // Always accept USER — displace lowest-priority queued item if full
    if (depth >= this.maxDepth) {
      if (task.priority === 'USER') {
        this.displaceLowestPriority()
      } else if (task.priority === 'SCHEDULED') {
        // Hold — wait for a slot; effectively the queue is just very deep
        // for scheduled tasks, they aren't rejected
      } else {
        // BACKGROUND — reject
        return false
      }
    }

    this.queue.push(task)
    this.queue.sort((a, b) => {
      // Sort by priority (highest first), then by enqueue time (FIFO within same priority)
      if (b.priorityValue !== a.priorityValue) return b.priorityValue - a.priorityValue
      return a.enqueuedAt - b.enqueuedAt
    })

    this.tryProcess()
    return true
  }

  /** Process the next task if a slot is available. */
  private tryProcess(): void {
    while (this.running < this.slotCount && this.queue.length > 0) {
      const task = this.queue.shift()!
      this.running++
      this.execute(task)
    }
  }

  private async execute(task: QueuedTask): Promise<void> {
    try {
      await task.execute()
    } finally {
      this.running--
      this.tryProcess()
    }
  }

  /**
   * Displace the lowest-priority item from the queue to make room for
   * a USER request.
   */
  private displaceLowestPriority(): void {
    if (this.queue.length === 0) return

    // Find the lowest-priority task (favor removing older same-priority)
    let lowestIdx = 0
    for (let i = 1; i < this.queue.length; i++) {
      const current = this.queue[i]
      const lowest = this.queue[lowestIdx]
      if (
        current.priorityValue < lowest.priorityValue ||
        (current.priorityValue === lowest.priorityValue &&
          current.enqueuedAt < lowest.enqueuedAt)
      ) {
        lowestIdx = i
      }
    }

    this.queue.splice(lowestIdx, 1)
  }

  /**
   * Starvation prevention: boost priority of tasks that have been waiting
   * longer than the threshold. Call periodically or automatically.
   */
  private checkStarvation(): void {
    const now = Date.now()
    for (const task of this.queue) {
      const waited = now - task.enqueuedAt
      if (waited >= this.starvationMs) {
        if (task.priority === 'BACKGROUND') {
          task.priority = 'SCHEDULED'
          task.priorityValue = PRIORITY_VALUE['SCHEDULED']
        } else if (task.priority === 'SCHEDULED') {
          task.priority = 'USER'
          task.priorityValue = PRIORITY_VALUE['USER']
        }
      }
    }

    // Re-sort after priority changes
    this.queue.sort((a, b) => {
      if (b.priorityValue !== a.priorityValue) return b.priorityValue - a.priorityValue
      return a.enqueuedAt - b.enqueuedAt
    })
  }

  /** Start the starvation checker background timer. */
  start(): void {
    if (this.timerId) return
    this.timerId = setInterval(() => this.checkStarvation(), 10_000)
  }

  /** Stop the starvation checker. */
  stop(): void {
    if (this.timerId) {
      clearInterval(this.timerId)
      this.timerId = null
    }
  }

  getStatus(): QueueStatus {
    return {
      running: this.running,
      queued: this.queue.length,
      paused: this.paused,
      slotsTotal: this.slotCount,
    }
  }

  statusLine(): string {
    const s = this.getStatus()
    return `\u26A1 ${s.running} running  \u2022 ${s.queued} queued${s.paused > 0 ? `  \u2022 ${s.paused} paused (approval needed)` : ''}`
  }
}
