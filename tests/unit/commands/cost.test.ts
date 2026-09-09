import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

const mockCosts = [
  { timestamp: '2026-01-15T10:00:00Z', member: 'the-scribe', model: 'gpt-4o-mini', provider: 'openai', promptTokens: 1000, completionTokens: 500, totalTokens: 1500, costUsd: 0.001 },
  { timestamp: '2026-01-15T11:00:00Z', member: 'the-reviewer', model: 'claude-3-5-sonnet', provider: 'anthropic', promptTokens: 2000, completionTokens: 1000, totalTokens: 3000, costUsd: 0.015 },
  { timestamp: '2026-01-16T10:00:00Z', member: 'the-scribe', model: 'gpt-4o-mini', provider: 'openai', promptTokens: 500, completionTokens: 200, totalTokens: 700, costUsd: 0.0005 },
]

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>()
  return { ...actual }
})

import { command } from '../../../src/commands/cost.ts'

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
})
