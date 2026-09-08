import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

import { RunHistory } from '../../../src/evals/runHistory.ts'
import type { EvalRunRecord } from '../../../src/evals/types.ts'

function run(over: Partial<EvalRunRecord>): EvalRunRecord {
  return {
    version: '0.0.0', timestamp: '2025-01-01T00:00:00.000Z', member: 'm', suiteName: 's',
    passRate: 0.8, aggregate: { relevance: 0.8 }, taskCount: 5, durationMs: 1000, ...over,
  }
}

let tempDir: string

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), 'agenthood-history-test-'))
})

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true })
})

describe('RunHistory', () => {
  it('append creates the directory and writes a JSONL line', () => {
    const history = new RunHistory('the-scribe', tempDir)
    history.append(run({ member: 'the-scribe' }))

    const path = RunHistory.historyPath('the-scribe', tempDir)
    const content = readFileSync(path, 'utf8')
    expect(JSON.parse(content.trim())).toMatchObject({ member: 'the-scribe', passRate: 0.8 })
  })

  it('load returns records oldest-first', () => {
    const history = new RunHistory('the-scribe', tempDir)
    history.append(run({ timestamp: '2025-01-01T00:00:00.000Z', passRate: 0.7 }))
    history.append(run({ timestamp: '2025-01-02T00:00:00.000Z', passRate: 0.9 }))

    const loaded = history.load()
    expect(loaded).toHaveLength(2)
    expect(loaded[0].timestamp).toBe('2025-01-01T00:00:00.000Z')
    expect(loaded[1].timestamp).toBe('2025-01-02T00:00:00.000Z')
  })

  it('loadForSuite filters by suite name', () => {
    const history = new RunHistory('the-scribe', tempDir)
    history.append(run({ suiteName: 'suite-a', passRate: 0.7 }))
    history.append(run({ suiteName: 'suite-b', passRate: 0.8 }))
    history.append(run({ suiteName: 'suite-a', passRate: 0.9 }))

    const filtered = history.loadForSuite('suite-a')
    expect(filtered).toHaveLength(2)
    expect(filtered.every((r) => r.suiteName === 'suite-a')).toBe(true)
  })

  it('load returns empty array when file does not exist', () => {
    const history = new RunHistory('nonexistent', tempDir)
    expect(history.load()).toEqual([])
  })

  it('clear removes the history file', () => {
    const history = new RunHistory('the-scribe', tempDir)
    history.append(run({}))
    expect(history.load()).toHaveLength(1)

    history.clear()
    expect(history.load()).toHaveLength(0)
  })

  it('clear is a no-op when file is already gone', () => {
    const history = new RunHistory('the-scribe', tempDir)
    expect(() => history.clear()).not.toThrow()
  })

  it('load skips malformed lines', () => {
    const path = RunHistory.historyPath('the-scribe', tempDir)
    mkdirSync(tempDir, { recursive: true })
    writeFileSync(path, `{"valid":true}\nnot-json\n{"also":true}\n`)

    const history = new RunHistory('the-scribe', tempDir)
    const loaded = history.load()
    expect(loaded).toHaveLength(2)
  })
})
