import { describe, it, expect } from 'vitest'
import { healthCheck } from '../../../src/core/healthCheck.js'
import type { HealthDeps } from '../../../src/core/healthCheck.js'

function deps(overrides: Partial<HealthDeps> = {}): HealthDeps {
  return {
    tracer: { size: 0, capacity: 1000 },
    traceStoreProbe: async () => true,
    memberCount: 19,
    ...overrides,
  }
}

describe('healthCheck', () => {
  it('reports healthy when every component is ok', async () => {
    const report = await healthCheck(deps())
    expect(report.status).toBe('healthy')
    expect(report.version).toBeTruthy()
    expect(report.uptimeMs).toBeGreaterThanOrEqual(0)
    expect(report.checks.map((c) => c.name).sort()).toEqual(['memberRegistry', 'traceStore', 'tracer'])
  })

  it('includes sentry, baselines, and retention checks when their deps are provided', async () => {
    const report = await healthCheck(
      deps({
        sentry: { dsn: 'https://abc@o1.ingest.sentry.io/2' },
        baselinesProbe: async () => true,
        retentionProbe: async () => true,
      }),
    )
    expect(report.checks.map((c) => c.name).sort()).toEqual([
      'baselines',
      'memberRegistry',
      'retention',
      'sentry',
      'traceStore',
      'tracer',
    ])
    expect(report.status).toBe('healthy')
    expect(report.checks.find((c) => c.name === 'sentry')?.detail).toBe('configured')
  })

  it('flags an invalid sentry DSN as degraded', async () => {
    const report = await healthCheck(deps({ sentry: { dsn: 'not-a-url' } }))
    expect(report.status).toBe('degraded')
    expect(report.checks.find((c) => c.name === 'sentry')?.status).toBe('degraded')
  })

  it('reports sentry as ok with a note when no DSN is configured', async () => {
    const report = await healthCheck(deps({ sentry: {} }))
    expect(report.status).toBe('healthy')
    expect(report.checks.find((c) => c.name === 'sentry')).toMatchObject({ status: 'ok', detail: 'not configured' })
  })

  it('reports missing baselines or retention as informational ok', async () => {
    const report = await healthCheck(
      deps({ baselinesProbe: async () => false, retentionProbe: async () => false }),
    )
    expect(report.status).toBe('healthy')
    expect(report.checks.find((c) => c.name === 'baselines')).toMatchObject({
      status: 'ok',
      detail: 'no baselines — quality not stamped',
    })
    expect(report.checks.find((c) => c.name === 'retention')).toMatchObject({
      status: 'ok',
      detail: 'no retention policy — traces kept indefinitely',
    })
  })

  it('reports degraded when the tracer is at capacity', async () => {
    const report = await healthCheck(deps({ tracer: { size: 1000, capacity: 1000 } }))
    expect(report.status).toBe('degraded')
    const tracer = report.checks.find((c) => c.name === 'tracer')
    expect(tracer?.status).toBe('degraded')
    expect(tracer?.detail).toBe('1000/1000 envelopes')
  })

  it('reports unhealthy when the trace store is unreachable', async () => {
    const report = await healthCheck(deps({ traceStoreProbe: async () => false }))
    expect(report.status).toBe('unhealthy')
    const store = report.checks.find((c) => c.name === 'traceStore')
    expect(store?.status).toBe('unhealthy')
  })

  it('reports degraded when the member registry is empty', async () => {
    const report = await healthCheck(deps({ memberCount: 0 }))
    expect(report.status).toBe('degraded')
  })

  it('includes provider checks when configured and flags missing keys as degraded', async () => {
    const report = await healthCheck(
      deps({
        providers: [
          { name: 'groq', probe: async () => true },
          { name: 'anthropic', probe: async () => false },
        ],
      }),
    )
    expect(report.status).toBe('degraded')
    expect(report.checks.find((c) => c.name === 'provider:groq')?.status).toBe('ok')
    expect(report.checks.find((c) => c.name === 'provider:anthropic')?.status).toBe('degraded')
  })
})
