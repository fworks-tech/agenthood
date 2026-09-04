import { describe, it, expect, vi } from 'vitest'
import { RedactionFilter, createRedactionFilterFromConfig } from '../../../src/core/RedactionFilter.ts'
import { Tracer } from '../../../src/core/Tracer.ts'
import { createTraceEnvelope } from '../../../src/core/TraceEnvelope.ts'
import type { TraceEnvelope } from '../../../src/core/types.ts'

function envelope(input: string, output = 'safe output'): TraceEnvelope {
  return createTraceEnvelope({
    member: 'the-reviewer',
    input,
    output,
    durationMs: 10,
    tokenCount: { input: 10, output: 5, total: 15 },
    cost: 0.001,
    qualityScore: 0.9,
    status: 'success',
    correlationId: 'corr-1',
  })
}

describe('RedactionFilter', () => {
  it('redacts email addresses', () => {
    const filter = new RedactionFilter({ enabled: true })
    expect(filter.redact(envelope('write to user@example.com now')).input).toContain('[REDACTED]')
    expect(filter.redact(envelope('write to user@example.com now')).input).not.toContain('user@example.com')
  })

  it('redacts sk- API keys and bearer tokens', () => {
    const filter = new RedactionFilter({ enabled: true })
    expect(filter.redact(envelope('key sk-abc123def456ghi789')).input).toContain('key [REDACTED]')
    expect(filter.redact(envelope('Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.some.token')).input)
      .toContain('Authorization: [REDACTED]')
  })

  it('redacts URL query parameter values but keeps the key', () => {
    const filter = new RedactionFilter({ enabled: true })
    expect(filter.redact(envelope('call https://api.example.com/users?token=abc123')).input)
      .toBe('call https://api.example.com/users?token=[REDACTED]')
  })

  it('redacts IPv4 and IPv6 addresses', () => {
    const filter = new RedactionFilter({ enabled: true })
    expect(filter.redact(envelope('server at 192.168.1.10 crashed')).input).toContain('server at [REDACTED] crashed')
    expect(filter.redact(envelope('fe80::1a2b:3c4d resolved')).input).toContain('[REDACTED] resolved')
  })

  it('does not redact clock times that look like IPv6 segments', () => {
    const filter = new RedactionFilter({ enabled: true })
    expect(filter.redact(envelope('ran at 10:30:45 UTC')).input).toBe('ran at 10:30:45 UTC')
    expect(filter.redact(envelope('timeout at 14:00:00 exactly')).input).toBe('timeout at 14:00:00 exactly')
  })

  it('redacts absolute paths under configured roots only', () => {
    const filter = new RedactionFilter({ enabled: true, paths: ['/home/alice'] })
    expect(filter.redact(envelope('edit /home/alice/projects/app/src/main.ts')).input)
      .toBe('edit [REDACTED]')
    expect(filter.redact(envelope('edit /opt/shared/scripts/run.sh')).input)
      .toBe('edit /opt/shared/scripts/run.sh')
  })

  it('applies custom regex rules from config', () => {
    const filter = new RedactionFilter({ enabled: true, rules: ['\\b[A-Z0-9]{10}\\b'] })
    expect(filter.redact(envelope('order ABCDEFGHIJ placed')).input).toBe('order [REDACTED] placed')
  })

  it('skips invalid custom rules with a warning', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const filter = new RedactionFilter({ enabled: true, rules: ['[unclosed'] })
    expect(filter.redact(envelope('plain text')).input).toBe('plain text')
    expect(warn).toHaveBeenCalled()
  })

  it('applies multiple rules to the same field', () => {
    const filter = new RedactionFilter({ enabled: true })
    const result = filter.redact(envelope('mail user@example.com from 192.168.0.1'))
    expect(result.input).toBe('mail [REDACTED] from [REDACTED]')
  })

  it('passes through unchanged when explicitly disabled', () => {
    const filter = new RedactionFilter({ enabled: false })
    const env = envelope('user@example.com sk-abc123def456ghi789')
    expect(filter.redact(env)).toBe(env)
  })

  it('is enabled by default when constructed without options', () => {
    const filter = new RedactionFilter()
    expect(filter.enabled()).toBe(true)
    expect(filter.redact(envelope('mail user@example.com')).input).toContain('[REDACTED]')
  })

  it('preserves all non-sensitive envelope structure', () => {
    const filter = new RedactionFilter({ enabled: true })
    const env = envelope('user@example.com')
    const redacted = filter.redact(env)
    expect(redacted.member).toBe(env.member)
    expect(redacted.correlationId).toBe(env.correlationId)
    expect(redacted.inputHash).toBe(env.inputHash)
    expect(redacted.tokenCount).toEqual(env.tokenCount)
    expect(redacted.status).toBe(env.status)
    expect(redacted.output).toBe(env.output)
  })

  it('returns the same envelope when nothing matches', () => {
    const filter = new RedactionFilter({ enabled: true })
    const env = envelope('plain task text')
    expect(filter.redact(env)).toBe(env)
  })

  it('redacts strings inside nested metadata and preserves non-plain values', () => {
    const filter = new RedactionFilter({ enabled: true })
    const createdAt = new Date('2026-01-01T00:00:00.000Z')
    const err = new Error('boom')
    const env: TraceEnvelope = {
      ...envelope('task'),
      message: 'user@example.com hit an error',
      metadata: { owner: 'dev@example.com', createdAt, err },
    }

    const redacted = filter.redact(env)
    expect(redacted.message).toBe('[REDACTED] hit an error')
    expect((redacted.metadata as Record<string, unknown>).owner).toBe('[REDACTED]')
    expect(redacted.metadata?.createdAt).toBe(createdAt)
    expect(redacted.metadata?.err).toBe(err)
  })

  it('returns the original envelope when nested metadata is unchanged', () => {
    const filter = new RedactionFilter({ enabled: true })
    const env: TraceEnvelope = {
      ...envelope('task'),
      message: 'plain log',
      metadata: { count: 3, nested: { ok: true } },
    }

    expect(filter.redact(env)).toBe(env)
  })

  it('does not recurse forever on circular metadata', () => {
    const filter = new RedactionFilter({ enabled: true })
    const circular: Record<string, unknown> = { label: 'self' }
    circular.self = circular
    const env: TraceEnvelope = {
      ...envelope('task'),
      message: 'user@example.com',
      metadata: { circular },
    }

    const redacted = filter.redact(env)
    const meta = redacted.metadata as { circular: Record<string, unknown> }
    expect(meta.circular.label).toBe('self')
    expect(meta.circular.self).toBe(circular)
  })
})

describe('createRedactionFilterFromConfig', () => {
  it('returns undefined when the observability block is absent', () => {
    expect(createRedactionFilterFromConfig({ providers: [] })).toBeUndefined()
    expect(createRedactionFilterFromConfig(undefined)).toBeUndefined()
  })

  it('builds an enabled filter from config', () => {
    const filter = createRedactionFilterFromConfig({
      observability: { redaction: { enabled: true, rules: ['\\bSECRET\\b'], paths: ['/tmp'] } },
    })
    expect(filter?.enabled()).toBe(true)
    expect(filter?.redact(envelope('SECRET value')).input).toBe('[REDACTED] value')
  })

  it('defaults to enabled when the block omits the flag', () => {
    const filter = createRedactionFilterFromConfig({ observability: { redaction: { rules: ['\\bSECRET\\b'] } } })
    expect(filter?.enabled()).toBe(true)
  })

  it('builds a disabled filter when enabled is false', () => {
    const filter = createRedactionFilterFromConfig({ observability: { redaction: { enabled: false } } })
    expect(filter?.enabled()).toBe(false)
  })
})

describe('Tracer redaction integration', () => {
  it('records redacted envelopes in the buffer and pending flush', async () => {
    const redactor = new RedactionFilter({ enabled: true })
    const tracer = new Tracer(10, undefined, 5000, redactor)
    tracer.record(envelope('user@example.com'))

    const recent = tracer.getRecent(1)
    expect(recent[0].input).toBe('[REDACTED]')
  })
})
