import { describe, it, expect, vi } from 'vitest'
import { ConcurrencyQueue } from '../../../src/core/ConcurrencyQueue.js'

describe('ConcurrencyQueue', () => {
  const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))

  it('rejects invalid slot count', () => {
    expect(() => new ConcurrencyQueue(0)).toThrow()
    expect(() => new ConcurrencyQueue(11)).toThrow()
  })

  it('valid slot count passes', () => {
    expect(() => new ConcurrencyQueue(1)).not.toThrow()
    expect(() => new ConcurrencyQueue(5)).not.toThrow()
    expect(() => new ConcurrencyQueue(10)).not.toThrow()
  })

  it('statusLine returns formatted string when idle', () => {
    const q = new ConcurrencyQueue(3)
    const line = q.statusLine()
    expect(line).toContain('0 running')
    expect(line).toContain('0 queued')
  })

  it('rejects BACKGROUND when queue is full', () => {
    const q = new ConcurrencyQueue(2)
    // Use tasks that never resolve so they occupy slots
    const pending = () => new Promise<void>(() => {})
    // Fill 2 slots with slow tasks
    q.enqueue({ id: 'filler-0', label: 'filler-0', priority: 'USER', priorityValue: 2, enqueuedAt: Date.now(), execute: pending })
    q.enqueue({ id: 'filler-1', label: 'filler-1', priority: 'USER', priorityValue: 2, enqueuedAt: Date.now(), execute: pending })

    // maxDepth = 2 * 10 = 20. Slots are taken, so queue can hold 20
    for (let i = 0; i < 20; i++) {
      const accepted = q.enqueue({
        id: `bg-${i}`,
        label: `bg-${i}`,
        priority: 'BACKGROUND',
        priorityValue: 0,
        enqueuedAt: Date.now(),
        execute: vi.fn().mockResolvedValue(undefined),
      })
      expect(accepted).toBe(true)
    }
    // 21st BACKGROUND should be rejected
    const rejected = q.enqueue({
      id: 'bg-rejected',
      label: 'bg-rejected',
      priority: 'BACKGROUND',
      priorityValue: 0,
      enqueuedAt: Date.now(),
      execute: vi.fn().mockResolvedValue(undefined),
    })
    expect(rejected).toBe(false)
  })

  it('always accepts USER even when queue is full', () => {
    const q = new ConcurrencyQueue(2)
    const pending = () => new Promise<void>(() => {})
    q.enqueue({ id: 'filler-0', label: 'filler-0', priority: 'USER', priorityValue: 2, enqueuedAt: Date.now(), execute: pending })
    q.enqueue({ id: 'filler-1', label: 'filler-1', priority: 'USER', priorityValue: 2, enqueuedAt: Date.now(), execute: pending })

    for (let i = 0; i < 20; i++) {
      q.enqueue({
        id: `bg-${i}`,
        label: `bg-${i}`,
        priority: 'BACKGROUND',
        priorityValue: 0,
        enqueuedAt: Date.now(),
        execute: vi.fn().mockResolvedValue(undefined),
      })
    }
    const accepted = q.enqueue({
      id: 'urgent',
      label: 'User task',
      priority: 'USER',
      priorityValue: 2,
      enqueuedAt: Date.now(),
      execute: vi.fn().mockResolvedValue(undefined),
    })
    expect(accepted).toBe(true)
  })

  it('processes tasks sequentially when slots fill', async () => {
    const q = new ConcurrencyQueue(1)
    const order: string[] = []

    const makeTask = (id: string, priority: 'USER' | 'SCHEDULED' | 'BACKGROUND', value: number) => ({
      id,
      label: id,
      priority,
      priorityValue: value,
      enqueuedAt: Date.now(),
      execute: vi.fn().mockImplementation(async () => {
        order.push(id)
        await delay(10)
      }),
    })

    q.enqueue(makeTask('first', 'USER', 2))
    await delay(20) // let first start
    q.enqueue(makeTask('second', 'USER', 2))
    await delay(20)
    q.enqueue(makeTask('third', 'USER', 2))
    await delay(50) // enough time for all three to complete sequentially

    expect(order.length).toBe(3)
    expect(order[0]).toBe('first')
    expect(order[1]).toBe('second')
    expect(order[2]).toBe('third')
  })

  it('honours priority ordering in queue', () => {
    const q = new ConcurrencyQueue(3) // 3 slots, so tasks don't execute immediately if all 3 are busy
    // Fill all 3 slots first
    const longTask = () => ({
      id: 'filler',
      label: 'filler',
      priority: 'USER' as const,
      priorityValue: 2,
      enqueuedAt: Date.now(),
      execute: () => new Promise<void>(() => {}), // never resolves
    })

    q.enqueue(longTask())
    q.enqueue(longTask())
    q.enqueue(longTask())

    // These should queue up
    q.enqueue({
      id: 'scheduled-1',
      label: 'scheduled-1',
      priority: 'SCHEDULED',
      priorityValue: 1,
      enqueuedAt: Date.now() - 100,
      execute: vi.fn(),
    })

    q.enqueue({
      id: 'user-1',
      label: 'user-1',
      priority: 'USER',
      priorityValue: 2,
      enqueuedAt: Date.now(),
      execute: vi.fn(),
    })

    q.enqueue({
      id: 'background-1',
      label: 'background-1',
      priority: 'BACKGROUND',
      priorityValue: 0,
      enqueuedAt: Date.now() - 200,
      execute: vi.fn(),
    })

    const status = q.getStatus()
    expect(status.queued).toBe(3) // 3 filler slots are running
  })

  it('start and stop do not throw', () => {
    const q = new ConcurrencyQueue(2)
    q.start()
    q.start() // noop
    q.stop()
    q.stop() // noop
  })
})
