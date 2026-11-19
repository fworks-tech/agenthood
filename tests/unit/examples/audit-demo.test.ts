import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { audit } from '../../../src/commands/audit.ts'

/** The shipped demo trail must stay a passing example, or the video shows a broken screen. */
const demo = join(process.cwd(), 'examples', 'audit-demo')

afterEach(() => {
  vi.restoreAllMocks()
  process.exitCode = undefined
})

describe('audit demo trail', () => {
  it('passes --strict with every decision chained', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    try {
      await audit(['--json', '--strict'], demo)
      const payload = JSON.parse(String(log.mock.calls.flat()[0]))

      expect(payload.ok).toBe(true)
      expect(payload.chain).toEqual({ valid: true })
      expect(payload.counts).toMatchObject({ decisions: 4, provenance: 4, routing: 2, traces: 4 })
      expect(payload.provenanceStates).toEqual({ chained: 4, unchained: 0, suspect: 0 })
      expect(payload.decisionsWithoutProvenance).toEqual([])
      expect(payload.orphans).toEqual([])
      expect(payload.routingFailures).toEqual([])
      expect(process.exitCode).toBeUndefined()
    } finally {
      log.mockRestore()
    }
  })

  it('prints the run metrics next to the provenance rows', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    try {
      await audit([], demo)
      const text = log.mock.calls.flat().join('\n')

      expect(text).toContain('4 decision(s), 4 provenance, 2 routing')
      expect(text).toContain('Provenance coverage: 4 chained, 0 unchained, 0 unverified')
      expect(text).toContain('96.5s · $0.0488 · 61905 tok')
      expect(text).toContain('The trail is complete and the chain is intact.')
    } finally {
      log.mockRestore()
    }
  })
})
