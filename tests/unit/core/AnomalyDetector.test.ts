import { describe, it, expect } from 'vitest'
import { AnomalyDetector, createAnomalyConfigFromConfig } from '../../../src/core/AnomalyDetector.ts'
import { createTraceEnvelope } from '../../../src/core/TraceEnvelope.ts'
import type { TraceEnvelope } from '../../../src/core/types.ts'

function envelope(member: string, overrides: Partial<TraceEnvelope> = {}): TraceEnvelope {
  return createTraceEnvelope({
    member,
    input: 'task',
    output: 'out',
    durationMs: 10,
    tokenCount: { input: 10, output: 5, total: 15 },
    cost: 0.001,
    qualityScore: null,
    status: 'success',
    correlationId: `${member}-${Math.random()}`,
    timestamp: new Date().toISOString(),
    ...overrides,
  })
}

describe('AnomalyDetector', () => {
  it('does not alert on normal variation', () => {
    const detector = new AnomalyDetector()
    const traces = [0.9, 1.0, 1.1, 0.8, 1.05].map((mult) =>
      envelope('the-scribe', { cost: 0.001 * mult, qualityScore: 0.8 }),
    )
    expect(detector.evaluate(traces)).toEqual([])
  })

  it('alerts on a cost spike above the threshold multiple', () => {
    const detector = new AnomalyDetector()
    const traces = [
      envelope('the-scribe', { cost: 0.001 }),
      envelope('the-scribe', { cost: 0.001 }),
      envelope('the-scribe', { cost: 0.005 }),
    ]
    const anomalies = detector.evaluate(traces)
    expect(anomalies).toHaveLength(1)
    expect(anomalies[0]).toMatchObject({ type: 'cost_spike', member: 'the-scribe', current: 0.005 })
    expect(anomalies[0].baseline).toBeCloseTo(0.001, 5)
  })

  it('alerts on a quality drop below the threshold', () => {
    const detector = new AnomalyDetector()
    const traces = [
      envelope('the-reviewer', { qualityScore: 0.9 }),
      envelope('the-reviewer', { qualityScore: 0.85 }),
      envelope('the-reviewer', { qualityScore: 0.4 }),
    ]
    const anomalies = detector.evaluate(traces)
    expect(anomalies).toHaveLength(1)
    expect(anomalies[0]).toMatchObject({ type: 'quality_drop', member: 'the-reviewer', current: 0.4 })
  })

  it('skips quality detection when no scores exist', () => {
    const detector = new AnomalyDetector()
    const traces = [envelope('the-reviewer'), envelope('the-reviewer'), envelope('the-reviewer')]
    expect(detector.evaluate(traces)).toEqual([])
  })

  it('alerts on a frequency burst', () => {
    const detector = new AnomalyDetector()
    const traces = Array.from({ length: 11 }, () => envelope('the-scribe'))
    const anomalies = detector.evaluate(traces)
    expect(anomalies).toHaveLength(1)
    expect(anomalies[0]).toMatchObject({ type: 'frequency_burst', member: 'the-scribe', current: 11 })
  })

  it('suppresses duplicate alerts during the cooldown', () => {
    const detector = new AnomalyDetector({ cooldownMinutes: 60 })
    const spike = [
      envelope('the-scribe', { cost: 0.001 }),
      envelope('the-scribe', { cost: 0.001 }),
      envelope('the-scribe', { cost: 0.005 }),
    ]
    expect(detector.evaluate(spike)).toHaveLength(1)
    expect(detector.evaluate(spike)).toHaveLength(0)
  })

  it('fires again after the cooldown expires', () => {
    const detector = new AnomalyDetector({ cooldownMinutes: 0 })
    const spike = [
      envelope('the-scribe', { cost: 0.001 }),
      envelope('the-scribe', { cost: 0.001 }),
      envelope('the-scribe', { cost: 0.005 }),
    ]
    expect(detector.evaluate(spike)).toHaveLength(1)
    expect(detector.evaluate(spike)).toHaveLength(1)
  })

  it('respects custom thresholds', () => {
    const strict = new AnomalyDetector({ costThreshold: 1.5, qualityDrop: 0.05, burstThreshold: 2 })
    const traces = [
      envelope('the-scribe', { cost: 0.001, qualityScore: 0.8 }),
      envelope('the-scribe', { cost: 0.002, qualityScore: 0.7 }),
      envelope('the-scribe', { cost: 0.003, qualityScore: 0.79 }),
    ]
    const anomalies = strict.evaluate(traces)
    const types = anomalies.map((a) => a.type).sort()
    expect(types).toEqual(['cost_spike', 'frequency_burst', 'quality_drop'])
  })

  it('handles separate members independently', () => {
    const detector = new AnomalyDetector()
    const traces = [
      envelope('the-scribe', { cost: 0.001 }),
      envelope('the-scribe', { cost: 0.001 }),
      envelope('the-reviewer', { cost: 0.001 }),
      envelope('the-reviewer', { cost: 0.1 }),
    ]
    const anomalies = detector.evaluate(traces)
    expect(anomalies).toHaveLength(1)
    expect(anomalies[0].member).toBe('the-reviewer')
  })
})

describe('createAnomalyConfigFromConfig', () => {
  it('returns undefined without an observability.alerts block', () => {
    expect(createAnomalyConfigFromConfig({})).toBeUndefined()
    expect(createAnomalyConfigFromConfig(undefined)).toBeUndefined()
  })

  it('maps alert options from config', () => {
    const config = createAnomalyConfigFromConfig({
      observability: { alerts: { costThreshold: 4.5, qualityDrop: 0.1, cooldownMinutes: 30 } },
    })
    expect(config).toEqual({ costThreshold: 4.5, qualityDrop: 0.1, cooldownMinutes: 30 })
  })

  it('maps burstThreshold from config', () => {
    const config = createAnomalyConfigFromConfig({
      observability: { alerts: { burstThreshold: 25 } },
    })
    expect(config).toEqual({ burstThreshold: 25 })
  })
})

describe('appendAnomalies', () => {
  it('writes an NDJSON line per anomaly and creates the directory', async () => {
    const { mkdtempSync, rmSync } = await import('node:fs')
    const { tmpdir } = await import('node:os')
    const { join } = await import('node:path')
    const { readFileSync } = await import('node:fs')
    const { appendAnomalies } = await import( '../../../src/core/AnomalyDetector.ts')
    const dir = mkdtempSync(join(tmpdir(), 'agenthood-alerts-'))
    const file = join(dir, 'nested', 'anomalies.ndjson')

    await appendAnomalies(file, [
      { type: 'cost_spike', member: 'the-builder', current: 4, baseline: 0.5, timestamp: '2026-08-14T00:00:00.000Z' },
    ])
    await appendAnomalies(file, [
      { type: 'quality_drop', member: 'the-reviewer', current: 0.4, baseline: 0.8, timestamp: '2026-08-14T00:01:00.000Z' },
    ])

    const lines = readFileSync(file, 'utf8').trim().split('\n')
    expect(lines).toHaveLength(2)
    expect(JSON.parse(lines[0]).type).toBe('cost_spike')
    expect(JSON.parse(lines[1]).member).toBe('the-reviewer')
    rmSync(dir, { recursive: true, force: true })
  })

  it('is a no-op for an empty list', async () => {
    const { mkdtempSync, rmSync, existsSync } = await import('node:fs')
    const { tmpdir } = await import('node:os')
    const { join } = await import('node:path')
    const { appendAnomalies } = await import( '../../../src/core/AnomalyDetector.ts')
    const dir = mkdtempSync(join(tmpdir(), 'agenthood-alerts-'))
    const file = join(dir, 'anomalies.ndjson')

    await appendAnomalies(file, [])

    expect(existsSync(file)).toBe(false)
    rmSync(dir, { recursive: true, force: true })
  })
})
