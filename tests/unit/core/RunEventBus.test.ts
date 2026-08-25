import { describe, it, expect, vi } from 'vitest'
import { RunEventBus, redactEventText } from '../../../src/core/RunEventBus.ts'
import { RedactionFilter } from '../../../src/core/RedactionFilter.ts'
import type { RunEvent, RunEventListener } from '../../../src/core/RunEventBus.ts'
import type { ExecutionContext } from '../../../src/core/ExecutionContext.ts'

function baseEvent(overrides: Partial<RunEvent> = {}): RunEvent {
  return {
    executionId: 'exec-1',
    member: 'the-scribe',
    timestamp: '2026-01-01T00:00:00Z',
    type: 'run.started',
    task: 'write a commit message',
    ...overrides,
  }
}

function makeEvent<T extends RunEvent['type']>(
  type: T,
  extra: Omit<RunEvent & { type: T }, keyof RunEvent> = {} as never,
): RunEvent & { type: T } {
  return {
    executionId: 'exec-1',
    member: 'the-scribe',
    timestamp: '2026-01-01T00:00:00Z',
    type,
    ...extra,
  } as RunEvent & { type: T }
}

describe('RunEventBus', () => {
  it('delivers events to a single subscriber', () => {
    const bus = new RunEventBus()
    const received: RunEvent[] = []
    bus.subscribe((e) => received.push(e))

    const event = baseEvent()
    bus.emit(event)

    expect(received).toHaveLength(1)
    expect(received[0]).toBe(event)
  })

  it('delivers events to multiple subscribers', () => {
    const bus = new RunEventBus()
    const received1: RunEvent[] = []
    const received2: RunEvent[] = []
    bus.subscribe((e) => received1.push(e))
    bus.subscribe((e) => received2.push(e))

    bus.emit(baseEvent())

    expect(received1).toHaveLength(1)
    expect(received2).toHaveLength(1)
  })

  it('delivers events in subscription order', () => {
    const bus = new RunEventBus()
    const order: number[] = []

    bus.subscribe(() => order.push(1))
    bus.subscribe(() => order.push(2))
    bus.subscribe(() => order.push(3))

    bus.emit(baseEvent())

    expect(order).toEqual([1, 2, 3])
  })

  it('catches subscriber errors without breaking other subscribers', () => {
    const bus = new RunEventBus()
    const warn = vi.spyOn(console, 'error').mockImplementation(() => {})
    const received: RunEvent[] = []

    bus.subscribe(() => { throw new Error('boom') })
    bus.subscribe((e) => received.push(e))

    bus.emit(baseEvent())

    expect(received).toHaveLength(1)
    expect(warn).toHaveBeenCalledWith('[RunEventBus] subscriber failed: boom')
    warn.mockRestore()
  })

  it('unsubscribe prevents future delivery', () => {
    const bus = new RunEventBus()
    const received: RunEvent[] = []
    const unsub = bus.subscribe((e) => received.push(e))

    bus.emit(baseEvent())
    unsub()
    bus.emit(baseEvent())

    expect(received).toHaveLength(1)
  })

  it('size reflects active subscriber count', () => {
    const bus = new RunEventBus()
    expect(bus.size).toBe(0)

    const unsub1 = bus.subscribe(() => {})
    expect(bus.size).toBe(1)

    const unsub2 = bus.subscribe(() => {})
    expect(bus.size).toBe(2)

    unsub1()
    expect(bus.size).toBe(1)

    unsub2()
    expect(bus.size).toBe(0)
  })

  it('emits all 8 event types', () => {
    const bus = new RunEventBus()
    const received: RunEvent[] = []
    bus.subscribe((e) => received.push(e))

    const events: RunEvent[] = [
      makeEvent('run.started', { task: 'do something' }),
      makeEvent('reasoning', { step: 1, content: 'thinking...' }),
      makeEvent('tool.called', { step: 1, name: 'read_file', args: {} }),
      makeEvent('tool.result', { step: 1, name: 'read_file', output: 'done', durationMs: 10 }),
      makeEvent('decision.recorded', { decisionId: 'dec-1', outcome: 'success' }),
      makeEvent('provenance.recorded', { checksum: 'abc123' }),
      makeEvent('run.finished', { output: 'completed', durationMs: 100 }),
      makeEvent('run.failed', { error: 'something broke', durationMs: 50 }),
    ]

    for (const event of events) {
      bus.emit(event)
    }

    expect(received).toHaveLength(8)
    expect(received.map((e) => e.type)).toEqual([
      'run.started',
      'reasoning',
      'tool.called',
      'tool.result',
      'decision.recorded',
      'provenance.recorded',
      'run.finished',
      'run.failed',
    ])
  })

  it('Set deduplicates identical listeners (same function reference)', () => {
    const bus = new RunEventBus()
    const received: RunEvent[] = []
    const listener: RunEventListener = (e) => received.push(e)

    const unsub1 = bus.subscribe(listener)
    bus.subscribe(listener) // duplicate — Set ignores it

    expect(bus.size).toBe(1)

    bus.emit(baseEvent())
    expect(received).toHaveLength(1) // delivered once

    unsub1()
    bus.emit(baseEvent())
    expect(received).toHaveLength(1) // unsub removed the single entry
  })
})

describe('redactEventText', () => {
  it('returns text as-is when no redactor is present', () => {
    const ctx = { redactor: undefined } as unknown as ExecutionContext
    expect(redactEventText(ctx, 'hello world')).toBe('hello world')
  })

  it('redacts PII when a redactor is present', () => {
    const redactor = new RedactionFilter({ enabled: true })
    const ctx = { redactor } as unknown as ExecutionContext
    expect(redactEventText(ctx, 'user@example.com')).toBe('[REDACTED]')
  })

  it('returns empty string when redaction throws', () => {
    const redactor = {
      redactText: () => { throw new Error('redaction failed') },
    } as unknown as ExecutionContext['redactor']
    const ctx = { redactor } as unknown as ExecutionContext
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    expect(redactEventText(ctx, 'sensitive data')).toBe('')
    expect(warn).toHaveBeenCalledWith('[RunEventBus] event redaction failed: redaction failed')
    warn.mockRestore()
  })

  it('returns text when redactor is disabled', () => {
    const redactor = new RedactionFilter({ enabled: false })
    const ctx = { redactor } as unknown as ExecutionContext
    expect(redactEventText(ctx, 'user@example.com')).toBe('user@example.com')
  })
})
