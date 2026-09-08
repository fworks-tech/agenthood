import { describe, it, expect } from 'vitest'
import { join } from 'node:path'
import { evaluateSurfaces, formatTriggerReport, loadTriggerSet, runTriggerRate } from '../../../src/commands/evalTriggers.ts'
import type { TriggerQuerySet } from '../../../src/evals/trigger.ts'

const set: TriggerQuerySet = {
  member: 'the-scribe',
  shouldTrigger: ['write a commit message'],
  shouldNotTrigger: ['debug the crash'],
}

describe('loadTriggerSet', () => {
  it('reads and validates the shipped sample set', () => {
    const loaded = loadTriggerSet(join(process.cwd(), 'evals', 'triggers', 'the-scribe.json'))
    expect(loaded.member).toBe('the-scribe')
    expect(loaded.shouldTrigger.length).toBeGreaterThanOrEqual(5)
    expect(loaded.shouldNotTrigger.length).toBeGreaterThanOrEqual(4)
  })

  it('throws on a malformed set', () => {
    expect(() => loadTriggerSet(join(process.cwd(), 'evals', 'does-not-exist.json'))).toThrow()
  })
})

describe('evaluateSurfaces', () => {
  it('scores only the keyword surface without an embedder', async () => {
    const ranked = await evaluateSurfaces(set)
    expect(ranked).toHaveLength(1)
    expect(ranked[0].surface).toBe('keyword')
    expect(ranked[0].metrics.truePositive).toBe(1)
    expect(ranked[0].metrics.falseNegative).toBe(0)
  })

  it('adds the semantic surface when an embedder is provided', async () => {
    const embed = async (t: string) => (t.toLowerCase().includes('commit') ? [1, 0] : [0, 1])
    const ranked = await evaluateSurfaces(set, { embed })
    expect(ranked.map((r) => r.surface).sort()).toEqual(['keyword', 'semantic'])
    for (const r of ranked) expect(r.metrics.f1).toBeGreaterThanOrEqual(0)
  })
})

describe('formatTriggerReport', () => {
  it('renders the header, surface rows, split line, and healthy note', () => {
    const lines = formatTriggerReport({
      member: 'the-scribe',
      shouldTrigger: 5,
      shouldNot: 4,
      ranked: [{ surface: 'keyword', metrics: { precision: 1, recall: 1, accuracy: 1, f1: 1, truePositive: 5, falsePositive: 0, falseNegative: 0, trueNegative: 4 } }],
      trainF1: 1,
      valF1: 0.8,
      trainCount: 3,
      valCount: 2,
      recs: [],
    })
    const out = lines.join('\n')
    expect(out).toContain('Trigger rate — the-scribe')
    expect(out).toContain('5 should-trigger, 4 should-not')
    expect(out).toContain('keyword')
    expect(out).toMatch(/train 1\.00 \(3q\) \| validation 0\.80 \(2q\)/)
    expect(out).toContain('Healthy: precision and recall')
  })

  it('lists recommendations when present', () => {
    const lines = formatTriggerReport({
      member: 'x',
      shouldTrigger: 1,
      shouldNot: 1,
      ranked: [{ surface: 'semantic', metrics: { precision: 0, recall: 0, accuracy: 0, f1: 0, truePositive: 0, falsePositive: 0, falseNegative: 0, trueNegative: 0 } }],
      trainF1: 0,
      valF1: 0,
      trainCount: 0,
      valCount: 0,
      recs: ['  [semantic] narrow the description'],
    })
    expect(lines.join('\n')).toContain('[semantic] narrow the description')
  })
})

describe('runTriggerRate', () => {
  it('runs end-to-end and resolves without throwing', async () => {
    await expect(runTriggerRate(set)).resolves.toBeUndefined()
  })
})
