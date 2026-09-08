import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it, expect } from 'vitest'
import { loadEvalSuite } from '../../../src/evals/evalSuiteSchema.ts'

/** The 20 Agenthood members that must each ship an assertion-graded eval suite. */
const MEMBERS = [
  'the-architect',
  'the-auditor',
  'the-builder',
  'the-debugger',
  'the-doorman',
  'the-envoy',
  'the-herald',
  'the-inspector',
  'the-librarian',
  'the-mailman',
  'the-mediator',
  'the-operator',
  'the-oracle',
  'the-reviewer',
  'the-scribe',
  'the-sentinel',
  'the-steward',
  'the-strategist',
  'the-tester',
  'the-warden',
]

const dir = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'evals', 'benchmarks')
const baselineDir = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '.agenthood', 'baselines')

describe('member benchmark suites (#656)', () => {
  it('ships one suite per member', () => {
    const files = readdirSync(dir).filter((f) => f.startsWith('the-') && f.endsWith('.json'))
    expect(files.sort()).toEqual(MEMBERS.map((m) => `${m}.json`).sort())
  })

  for (const member of MEMBERS) {
    it(`${member}: valid, >=5 tasks, every task assertion-graded, no judge`, () => {
      const suite = loadEvalSuite(join(dir, `${member}.json`))
      expect(suite.name).toBe(member)
      expect(suite.tasks.length).toBeGreaterThanOrEqual(5)
      // CI-safe: no LLM judge metrics; deterministic assertions grade every task.
      expect(suite.metrics ?? []).toEqual([])
      for (const task of suite.tasks) {
        expect(task.assertions?.length ?? 0).toBeGreaterThanOrEqual(1)
        for (const a of task.assertions ?? []) {
          // Deliberately no 'semantic': it needs a live embedder, so it can
          // never be part of the deterministic CI-safe subset.
          expect(['exact', 'contains', 'regex']).toContain(a.type)
        }
      }
    })
  }

  for (const member of MEMBERS) {
    it(`${member}: baseline snapshot is well-formed`, () => {
      const baseline = JSON.parse(readFileSync(join(baselineDir, `${member}.json`), 'utf8'))
      expect(baseline.member).toBe(member)
      expect(baseline.suiteName).toBe(member)
      expect(typeof baseline.timestamp).toBe('string')
      expect(baseline.taskCount).toBeGreaterThanOrEqual(5)
      expect(typeof baseline.aggregate?.assertions).toBe('number')
    })
  }
})
