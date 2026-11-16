import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

import { status } from '../../../src/commands/status.ts'
import { health } from '../../../src/commands/health.ts'
import { trace } from '../../../src/commands/trace.ts'
import { optimize } from '../../../src/commands/optimize.ts'
import { readBaseline, baselinePath } from '../../../src/skills/observability.ts'

const SKILL = `---
name: the-probe
description: Use when probing skill observability end to end.
license: MIT
---

# The Probe

## Process

Read \`references/gone.md\` first.
`

const UNUSED = `---
name: the-unused
description: Use when something never runs.
license: MIT
---

# The Unused

## Process

Do nothing.
`

let dir: string
let cwd: string

function writeProject(): void {
  const skill = join(dir, 'skills', 'the-probe')
  mkdirSync(skill, { recursive: true })
  writeFileSync(join(skill, 'SKILL.md'), SKILL)
  const unused = join(dir, 'skills', 'the-unused')
  mkdirSync(unused, { recursive: true })
  writeFileSync(join(unused, 'SKILL.md'), UNUSED)

  mkdirSync(join(dir, '.agenthood', 'trajectories'), { recursive: true })
  writeFileSync(
    join(dir, '.agenthood', 'config.json'),
    JSON.stringify({ skills: { metadataBudget: 10 } }),
  )
  writeFileSync(
    join(dir, '.agenthood', 'skill-stats.json'),
    JSON.stringify({
      'the-probe': { activations: 5, successes: 1, failures: 4, lastRun: '2026-01-01T00:00:00.000Z' },
    }),
  )
  writeFileSync(
    join(dir, '.agenthood', 'skill-baseline.json'),
    JSON.stringify({ 'the-probe': 10 }),
  )
  writeFileSync(
    join(dir, '.agenthood', 'trajectories', 't1.json'),
    JSON.stringify({
      id: 't1',
      correlationId: 'c1',
      member: 'builder',
      task: 'probe',
      startedAt: '2026-01-01T00:00:00.000Z',
      completedAt: '2026-01-01T00:00:01.000Z',
      totalDurationMs: 1000,
      totalCost: 0,
      steps: Array.from({ length: 5 }, (_, i) => ({
        step: i + 1,
        model: 'm',
        skills: ['the-probe'],
        durationMs: 200,
        inputSummary: 'in',
        outputSummary: 'out',
        tokens: { prompt: 1, completion: 1 },
        cost: 0,
        status: 'success',
      })),
    }),
  )
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'skill-observability-'))
  cwd = process.cwd()
  writeProject()
  process.chdir(dir)
  process.exitCode = undefined
})

afterEach(() => {
  process.chdir(cwd)
  rmSync(dir, { recursive: true, force: true })
  process.exitCode = undefined
  vi.restoreAllMocks()
})

describe('status skill context (#586)', () => {
  it('lists per-skill catalog cost and flags the budget overflow', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    await status()
    const output = log.mock.calls.flat().join('\n')

    expect(output).toContain('Skill Context')
    expect(output).toContain('the-probe')
    expect(output).toContain('Catalog total:')
    expect(output).toContain('over budget')
    expect(output).toContain('disable-model-invocation')
  })

  it('includes the same rows in --json', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    await status(['--json'])
    const payload = JSON.parse(log.mock.calls.flat().join('')) as {
      skills: { budget: number; rows: { name: string; metadataTokens: number }[] }
    }

    expect(payload.skills.budget).toBe(10)
    const row = payload.skills.rows.find((entry) => entry.name === 'the-probe')
    expect(row?.metadataTokens).toBeGreaterThan(0)
  })
})

describe('health skill checks (#597, #626, #627)', () => {
  it('reports a stale reference, a failing activation rate and a regression', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    await health(['--json'])
    const report = JSON.parse(log.mock.calls.flat().join('')) as {
      status: string
      checks: { name: string; status: string; detail?: string }[]
    }
    const byName = Object.fromEntries(report.checks.map((check) => [check.name, check]))

    // user-scope skills are discovered too, so the detail stays a capped summary
    expect(byName.skills.detail).toMatch(/^0 error\(s\), \d+ warning\(s\)/)
    expect(byName.skillActivations.status).toBe('degraded')
    expect(byName.skillActivations.detail).toContain('the-probe 20% of 5')
    expect(byName.skillRegressions.status).toBe('degraded')
    expect(byName.skillRegressions.detail).toContain('the-probe +1900%')
    expect(report.status).toBe('degraded')
  })

  it('stamps the baseline from the trajectory store', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    await health(['--baseline'])

    expect(log.mock.calls.flat().join(' ')).toContain('baseline stamped for 1 skill')
    expect(readBaseline(dir)).toEqual({ 'the-probe': 200 })
    expect(baselinePath(dir)).toContain('skill-baseline.json')
  })
})

describe('trace activation history (#605)', () => {
  it('lists which skill was active in which run', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    await trace(['--activations'])

    const output = log.mock.calls.flat().join('\n')
    expect(output).toContain('the-probe')
    expect(output).toContain('builder')
    expect(output).toContain('200ms')
  })

  it('filters by skill and returns JSON on request', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    await trace(['--activations', '--skill', 'nothing-here', '--json'])

    expect(JSON.parse(log.mock.calls.flat().join(''))).toEqual({ activations: [] })
  })
})

describe('optimize --cost (#628)', () => {
  it('suggests acting on the skills that do not earn their catalog entry', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    await optimize(['--cost'])

    const output = log.mock.calls.flat().join('\n')
    expect(output).toContain('Skill Cost')
    expect(output).toContain('the-unused: never activated')
    expect(output).toContain('suggestion(s)')
  })

  it('returns the analysis as JSON', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    await optimize(['--cost', '--json'])
    const payload = JSON.parse(log.mock.calls.flat().join('')) as {
      suggestions: { skill: string }[]
    }

    expect(payload.suggestions.map((entry) => entry.skill)).toContain('the-unused')
  })
})
