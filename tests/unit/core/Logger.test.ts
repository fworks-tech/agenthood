import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, readFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Logger } from '../../../src/core/Logger.ts'
import { RunEventBus } from '../../../src/core/RunEventBus.ts'
import { RedactionFilter } from '../../../src/core/RedactionFilter.ts'
import type { TraceEnvelope } from '../../../src/core/types.ts'

describe('Logger', () => {
  let dir: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'agenthood-logger-'))
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  const traceFile = () => join(dir, '.agenthood', 'traces', 'traces.ndjson')
  const readEntries = (): TraceEnvelope[] =>
    readFileSync(traceFile(), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l) as TraceEnvelope)

  it('persists a log entry with level/message/member to the shared NDJSON store', async () => {
    const logger = new Logger({ projectPath: dir, source: 'api' })
    await logger.log('warn', 'drift detected', 'the-scribe')

    expect(existsSync(traceFile())).toBe(true)
    const [entry] = readEntries()
    expect(entry.entryType).toBe('log')
    expect(entry.level).toBe('warn')
    expect(entry.message).toBe('drift detected')
    expect(entry.member).toBe('the-scribe')
    expect(entry.source).toBe('api')
    expect(entry.timestamp).toBeTruthy()
  })

  it('defaults member to system when omitted', async () => {
    const logger = new Logger({ projectPath: dir })
    await logger.info('booted')
    const [entry] = readEntries()
    expect(entry.member).toBe('system')
  })

  it('maps convenience methods to levels', async () => {
    const logger = new Logger({ projectPath: dir })
    await logger.debug('d')
    await logger.info('i')
    await logger.warn('w')
    await logger.error('e')
    expect(readEntries().map((e) => e.level)).toEqual(['debug', 'info', 'warn', 'error'])
  })

  it('attaches metadata and a shared correlationId', async () => {
    const logger = new Logger({ projectPath: dir })
    await logger.error('boom', 'the-auditor', { code: 42 })
    const [entry] = readEntries()
    expect(entry.metadata).toEqual({ code: 42 })
    expect(entry.correlationId).toBeTruthy()
  })

  it('emits log.created on the event bus when provided', async () => {
    const bus = new RunEventBus()
    const events: unknown[] = []
    bus.subscribe((e) => events.push(e))
    const logger = new Logger({ projectPath: dir, events: bus })
    await logger.warn('watch out', 'the-warden')

    expect(events).toHaveLength(1)
    const evt = events[0] as { type: string; level: string; message: string }
    expect(evt.type).toBe('log.created')
    expect(evt.level).toBe('warn')
    expect(evt.message).toBe('watch out')
  })

  it('redacts secrets from message and metadata before persisting and emitting', async () => {
    const bus = new RunEventBus()
    const events: unknown[] = []
    bus.subscribe((e) => events.push(e))
    const logger = new Logger({ projectPath: dir, events: bus, redactor: new RedactionFilter() })
    await logger.info('key sk-abc1234567 leaked', 'the-scribe', { owner: 'dev@example.com' })

    const [entry] = readEntries()
    expect(entry.message).toBe('key [REDACTED] leaked')
    expect(entry.metadata).toEqual({ owner: '[REDACTED]' })
    const evt = events[0] as { message: string }
    expect(evt.message).toBe('key [REDACTED] leaked')
  })

  it('redacts nested metadata values', async () => {
    const logger = new Logger({ projectPath: dir, redactor: new RedactionFilter() })
    await logger.warn('deep', undefined, {
      user: { email: 'dev@example.com', aliases: ['a@example.com', 'b@example.com'] },
    })

    const [entry] = readEntries()
    expect(entry.metadata).toEqual({
      user: { email: '[REDACTED]', aliases: ['[REDACTED]', '[REDACTED]'] },
    })
  })

  it('redacts by default when config has no observability block (fails closed)', async () => {
    const logger = new Logger({ projectPath: dir })
    await logger.info('key sk-abc1234567 leaked')

    const [entry] = readEntries()
    expect(entry.message).toBe('key [REDACTED] leaked')
  })
})
