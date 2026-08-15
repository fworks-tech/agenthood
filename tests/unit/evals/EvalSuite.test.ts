import { describe, it, expect } from 'vitest'
import { validateEvalSuite, loadEvalSuite, EVAL_SUITE_SCHEMA } from '../../../src/evals/evalSuiteSchema.ts'
import { SchemaValidationError } from '../../../src/core/SchemaValidator.ts'
import { join } from 'node:path'

const validSuite = {
  name: 'test-suite',
  description: 'A valid suite',
  metrics: ['faithfulness', 'relevance'],
  tasks: [
    {
      input: 'do the thing',
      expectedOutput: 'the thing done',
      tags: ['code'],
      difficulty: 'easy',
    },
    {
      input: 'second task',
      expectedOutput: 'second output',
    },
  ],
}

describe('eval suite schema', () => {
  it('accepts a valid suite', () => {
    expect(() => validateEvalSuite(validSuite)).not.toThrow()
  })

  it('accepts the minimal suite shape', () => {
    expect(() => validateEvalSuite({ name: 'minimal', tasks: [{ input: 'a', expectedOutput: 'b' }] })).not.toThrow()
  })

  it('rejects a suite without a name', () => {
    expect(() => validateEvalSuite({ tasks: [{ input: 'a', expectedOutput: 'b' }] })).toThrow(SchemaValidationError)
  })

  it('rejects a suite without tasks', () => {
    expect(() => validateEvalSuite({ name: 'empty' })).toThrow(SchemaValidationError)
  })

  it('rejects a task missing expectedOutput with a clear error', () => {
    try {
      validateEvalSuite({ name: 'bad', tasks: [{ input: 'a' }] })
      expect.unreachable('should have thrown')
    } catch (err) {
      expect(err).toBeInstanceOf(SchemaValidationError)
      expect((err as SchemaValidationError).message).toContain('expectedOutput')
    }
  })

  it('rejects an invalid difficulty enum', () => {
    expect(() => validateEvalSuite({ name: 'bad', tasks: [{ input: 'a', expectedOutput: 'b', difficulty: 'expert' }] }))
      .toThrow(SchemaValidationError)
  })

  it('rejects unknown top-level properties', () => {
    expect(() => validateEvalSuite({ name: 'bad', tasks: [], bogus: true })).toThrow(SchemaValidationError)
  })

  it('validates against the exported schema directly', () => {
    expect(EVAL_SUITE_SCHEMA.type).toBe('object')
    expect(EVAL_SUITE_SCHEMA.required).toContain('tasks')
  })

  it('loads and validates the example suite file', () => {
    const suite = loadEvalSuite(join(process.cwd(), 'evals', 'developer-agent-suite.json'))
    expect(suite.name).toBe('developer-agent')
    expect(suite.tasks.length).toBeGreaterThanOrEqual(4)
    for (const task of suite.tasks) {
      expect(task.input).toBeTruthy()
      expect(task.expectedOutput).toBeTruthy()
    }
  })

  it('loads and validates every benchmark fixture', () => {
    const fixtures = ['review-pr', 'issue-triage', 'docs-sync', 'ci-diagnosis']
    for (const fixture of fixtures) {
      const suite = loadEvalSuite(join(process.cwd(), 'evals', 'benchmarks', `${fixture}.json`))
      expect(suite.name).toBe(fixture)
      expect(suite.tasks.length).toBeGreaterThanOrEqual(3)
      for (const task of suite.tasks) {
        expect(task.input).toBeTruthy()
        expect(task.expectedOutput).toBeTruthy()
        expect(task.difficulty).toBeTruthy()
        expect(task.tags?.length).toBeGreaterThan(0)
      }
    }
  })

  it('loadEvalSuite fails with a clear error on a missing file', () => {
    expect(() => loadEvalSuite(join(process.cwd(), 'evals', 'does-not-exist.json'))).toThrow(SchemaValidationError)
  })

  it('loadEvalSuite fails with a clear error on invalid JSON', async () => {
    const { mkdtempSync, writeFileSync } = await import('node:fs')
    const { tmpdir } = await import('node:os')
    const { join: joinPath } = await import('node:path')
    const dir = mkdtempSync(joinPath(tmpdir(), 'agenthood-suite-'))
    const bad = joinPath(dir, 'bad.json')
    writeFileSync(bad, '{ not json')
    expect(() => loadEvalSuite(bad)).toThrow(SchemaValidationError)
  })
})
