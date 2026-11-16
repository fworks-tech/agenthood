import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import {
  activationRates,
  costSuggestions,
  detectRegressions,
  failingActivations,
  metadataBudget,
  readBaseline,
  skillHealth,
  skillUsage,
  speedBySkill,
  writeBaseline,
} from '../../../src/skills/observability.ts'
import type { ISkillManifest } from '../../../src/skills/discovery/ISkillManifest.ts'
import type { SkillStats } from '../../../src/skills/activation/SkillStats.ts'
import type { Trajectory } from '../../../src/core/TrajectoryStore.ts'

function manifest(overrides: Partial<ISkillManifest> & { name: string }): ISkillManifest {
  return {
    description: `${overrides.name} skill`,
    tier: 'official',
    location: join('/skills', overrides.name, 'SKILL.md'),
    directory: join('/skills', overrides.name),
    body: 'Body',
    resources: [],
    ...overrides,
  } as ISkillManifest
}

function stat(activations: number, successes: number): SkillStats {
  return {
    'the-test': { activations, successes, failures: activations - successes, lastRun: null },
  }
}

describe('skill token usage (#586)', () => {
  it('counts the catalog entry, not the body, as the always-paid cost', () => {
    const [row] = skillUsage([manifest({ name: 'the-test', body: 'long body '.repeat(50) })], {})
    expect(row.metadataTokens).toBeGreaterThan(0)
    expect(row.bodyTokens).toBeGreaterThan(row.metadataTokens)
  })

  it('charges nothing for a skill the catalog hides', () => {
    const [row] = skillUsage([manifest({ name: 'the-test', hidden: true })], {})
    expect(row.metadataTokens).toBe(0)
  })

  it('reads the budget from config and falls back to 4000', () => {
    expect(metadataBudget('/nonexistent')).toBe(4000)
  })

  describe('with a project', () => {
    let dir: string
    beforeEach(() => {
      dir = mkdtempSync(join(tmpdir(), 'skill-budget-'))
    })
    afterEach(() => {
      rmSync(dir, { recursive: true, force: true })
    })

    it('honours skills.metadataBudget', () => {
      mkdirSync(join(dir, '.agenthood'), { recursive: true })
      writeFileSync(join(dir, '.agenthood', 'config.json'), JSON.stringify({ skills: { metadataBudget: 900 } }))
      expect(metadataBudget(dir)).toBe(900)
    })
  })
})

describe('skill health (#597)', () => {
  it('reports an empty body, a missing description and a name/directory mismatch as errors', () => {
    const problems = skillHealth([
      manifest({ name: 'the-empty', body: '', description: '' }),
      manifest({ name: 'the-renamed', directory: '/skills/other' }),
    ])
    expect(problems.filter((p) => p.level === 'error').map((p) => p.message)).toEqual([
      expect.stringContaining('no description'),
      expect.stringContaining('empty body'),
      expect.stringContaining('does not match'),
    ])
  })

  it('warns about a referenced file that is gone, and says how to fix it', () => {
    const [problem] = skillHealth([manifest({ name: 'the-test', body: 'Read `references/gone.md` first.' })])
    expect(problem.level).toBe('warn')
    expect(problem.message).toContain('references/gone.md')
    expect(problem.fix).toContain('Create the file')
  })
})

describe('activation monitoring (#626)', () => {
  it('computes the rate and sorts the worst first', () => {
    const stats: SkillStats = {
      good: { activations: 10, successes: 10, failures: 0, lastRun: null },
      bad: { activations: 4, successes: 1, failures: 3, lastRun: null },
    }
    expect(activationRates(stats).map((entry) => entry.skill)).toEqual(['bad', 'good'])
  })

  it('ignores a low rate until there are enough attempts', () => {
    expect(failingActivations(stat(4, 1))).toEqual([])
    expect(failingActivations(stat(5, 1))).toHaveLength(1)
  })
})

describe('regression detection (#627)', () => {
  const trajectories: Trajectory[] = [
    {
      id: 't1',
      correlationId: 'c',
      member: 'builder',
      task: 'x',
      startedAt: '2026-01-01T00:00:00.000Z',
      completedAt: '2026-01-01T00:00:01.000Z',
      totalDurationMs: 1000,
      totalCost: 0,
      steps: [
        { step: 1, model: 'm', skills: ['slow'], durationMs: 200 },
        { step: 2, model: 'm', skills: ['slow'], durationMs: 200 },
        { step: 3, model: 'm', skills: ['slow'], durationMs: 200 },
        { step: 4, model: 'm', skills: ['slow'], durationMs: 200 },
        { step: 5, model: 'm', skills: ['slow'], durationMs: 200 },
      ],
    } as Trajectory,
  ]

  it('averages step time per active skill', () => {
    expect(speedBySkill(trajectories)).toEqual({ slow: { meanMs: 200, samples: 5 } })
  })

  it('flags a mean well above the baseline and leaves noise alone', () => {
    const current = speedBySkill(trajectories)
    expect(detectRegressions(current, { slow: 100 })).toMatchObject([{ skill: 'slow', change: 1 }])
    expect(detectRegressions(current, { slow: 190 })).toEqual([])
  })

  it('needs a minimum sample size before it accuses anything', () => {
    const thin: Trajectory = {
      ...trajectories[0],
      steps: [{ step: 1, model: 'm', skills: ['slow'], durationMs: 999 }],
    } as Trajectory
    expect(detectRegressions(speedBySkill([thin]), { slow: 1 })).toEqual([])
  })

  describe('baseline', () => {
    let dir: string
    beforeEach(() => {
      dir = mkdtempSync(join(tmpdir(), 'skill-baseline-'))
    })
    afterEach(() => {
      rmSync(dir, { recursive: true, force: true })
    })

    it('round-trips a stamped baseline', () => {
      expect(readBaseline(dir)).toEqual({})
      writeBaseline(dir, { slow: { meanMs: 200, samples: 5 } })
      expect(readBaseline(dir)).toEqual({ slow: 200 })
    })
  })
})

describe('cost suggestions (#628)', () => {
  const usage = [
    { name: 'used', metadataTokens: 90, bodyTokens: 500, activations: 12 },
    { name: 'never', metadataTokens: 300, bodyTokens: 500, activations: 0 },
    { name: 'rare', metadataTokens: 250, bodyTokens: 500, activations: 2 },
  ]

  it('suggests removal for a never-activated skill and compression for a rare, large one', () => {
    expect(costSuggestions(usage)).toEqual([
      expect.objectContaining({ skill: 'never', suggestion: expect.stringContaining('never activated') }),
      expect.objectContaining({ skill: 'rare', suggestion: expect.stringContaining('compress the description') }),
    ])
  })

  it('says nothing on a project with no activation history', () => {
    expect(costSuggestions(usage.map((row) => ({ ...row, activations: 0 })))).toEqual([])
  })
})
