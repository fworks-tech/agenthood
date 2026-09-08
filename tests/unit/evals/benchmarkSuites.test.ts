import { readdirSync } from 'node:fs'
import { join } from 'node:path'
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

const dir = join(process.cwd(), 'evals', 'benchmarks')

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
          expect(['exact', 'contains', 'regex']).toContain(a.type)
        }
      }
    })
  }
})
