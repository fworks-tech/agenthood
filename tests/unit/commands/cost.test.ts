import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

const mockCosts = [
  { timestamp: '2026-01-15T10:00:00Z', member: 'the-scribe', model: 'gpt-4o-mini', provider: 'openai', promptTokens: 1000, completionTokens: 500, totalTokens: 1500, costUsd: 0.001 },
  { timestamp: '2026-01-15T11:00:00Z', member: 'the-reviewer', model: 'claude-3-5-sonnet', provider: 'anthropic', promptTokens: 2000, completionTokens: 1000, totalTokens: 3000, costUsd: 0.015 },
  { timestamp: '2026-01-16T10:00:00Z', member: 'the-scribe', model: 'gpt-4o-mini', provider: 'openai', promptTokens: 500, completionTokens: 200, totalTokens: 700, costUsd: 0.0005 },
]

import { command } from '../../../src/commands/cost.ts'
import { aggregateBySkill } from '../../../src/commands/cost.ts'
import { logCost, readCosts } from '../../../src/core/CostLogger.ts'

describe('cost command', () => {
  let testDir: string

  beforeEach(() => {
    testDir = join(tmpdir(), `agenthood-cost-test-${Date.now()}`)
    mkdirSync(join(testDir, '.agenthood'), { recursive: true })
    writeFileSync(join(testDir, '.agenthood', 'costs.jsonl'), mockCosts.map((c) => JSON.stringify(c)).join('\n') + '\n')
  })

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true })
  })

  it('has correct descriptor', () => {
    expect(command.name).toBe('cost')
    expect(command.description).toContain('cost')
    expect(typeof command.handler).toBe('function')
  })

  it('readCosts parses JSONL file', () => {
    const costs = readCosts(testDir)
    expect(costs.length).toBe(3)
    expect(costs[0].member).toBe('the-scribe')
  })

  it('readCosts returns empty array for missing file', () => {
    const emptyDir = join(tmpdir(), `agenthood-cost-empty-${Date.now()}`)
    mkdirSync(join(emptyDir, '.agenthood'), { recursive: true })
    const costs = readCosts(emptyDir)
    expect(costs.length).toBe(0)
    rmSync(emptyDir, { recursive: true, force: true })
  })

  it('logCost appends to file', () => {
    logCost({
      timestamp: '2026-01-17T10:00:00Z',
      member: 'the-doorman',
      model: 'gpt-4o-mini',
      provider: 'openai',
      promptTokens: 100,
      completionTokens: 50,
      totalTokens: 150,
      costUsd: 0.0001,
    }, testDir)
    const costs = readCosts(testDir)
    expect(costs.length).toBe(4)
    expect(costs[3].member).toBe('the-doorman')
  })

  it('logCost creates directory if missing', () => {
    const newDir = join(tmpdir(), `agenthood-cost-new-${Date.now()}`)
    logCost({
      timestamp: '2026-01-17T10:00:00Z',
      member: 'the-doorman',
      model: 'gpt-4o-mini',
      provider: 'openai',
      promptTokens: 100,
      completionTokens: 50,
      totalTokens: 150,
      costUsd: 0.0001,
    }, newDir)
    const costs = readCosts(newDir)
    expect(costs.length).toBe(1)
    rmSync(newDir, { recursive: true, force: true })
  })
})

describe('aggregateBySkill', () => {
  const entry = (skills: string[] | undefined, costUsd: number, totalTokens: number) =>
    ({ timestamp: '2026-01-15T10:00:00Z', member: 'm', model: 'x', provider: 'groq', promptTokens: totalTokens, completionTokens: 0, totalTokens, costUsd, skills })

  it('ignores steps with no skills', () => {
    expect(aggregateBySkill([entry(undefined, 1, 100)]).size).toBe(0)
  })

  it('charges a solo activation the full step cost', () => {
    const rows = aggregateBySkill([entry(['pdf-form-fill'], 0.002, 1200)])
    expect(rows.get('pdf-form-fill')).toEqual({ activations: 1, cost: 0.002, tokens: 1200 })
  })

  it('splits a step evenly across N skills', () => {
    const rows = aggregateBySkill([entry(['a', 'b'], 0.002, 1000)])
    expect(rows.get('a')!.cost).toBeCloseTo(0.001)
    expect(rows.get('b')!.cost).toBeCloseTo(0.001)
  })

  it('accumulates repeated activations of the same skill', () => {
    const rows = aggregateBySkill([entry(['a'], 0.001, 100), entry(['a'], 0.001, 300)])
    expect(rows.get('a')).toEqual({ activations: 2, cost: 0.002, tokens: 400 })
  })
})
