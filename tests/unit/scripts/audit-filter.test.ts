import { describe, it, expect } from 'vitest'
import { execFileSync } from 'node:child_process'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const dirname = fileURLToPath(new URL('.', import.meta.url))
const filter = join(dirname, '..', '..', '..', '.github', 'scripts', 'audit-filter.mjs')

function runFilter(json: unknown, min: number, exemptNpm: number): { code: number; output: string } {
  try {
    const output = execFileSync('node', [filter, JSON.stringify(json), String(min), String(exemptNpm)], {
      encoding: 'utf8',
    })
    return { code: 0, output }
  } catch (err) {
    const e = err as { status?: number; stdout?: string; stderr?: string }
    return { code: e.status ?? 1, output: `${e.stdout ?? ''}${e.stderr ?? ''}` }
  }
}

describe('audit-filter.mjs', () => {
  it('exits 0 on a clean audit', () => {
    expect(runFilter({ vulnerabilities: {} }, 3, 1)).toEqual({ code: 0, output: '' })
  })

  it('exits 1 and reports the upstream error when npm audit errors', () => {
    const res = runFilter({ error: { code: 'ETARGET', summary: 'registry error' } }, 3, 1)
    expect(res.code).toBe(1)
    expect(res.output).toContain('ETARGET')
  })

  it('exits 2 on a high advisory for a real project dependency', () => {
    const res = runFilter(
      { vulnerabilities: { foo: { severity: 'high', nodes: ['node_modules/foo'] } } },
      3, 1,
    )
    expect(res.code).toBe(2)
    expect(res.output).toContain('foo [high]')
  })

  it('exempts npm bundled deps (exact-path match) when exemptNpm is set', () => {
    const res = runFilter(
      { vulnerabilities: { 'npm-x': { severity: 'high', nodes: ['node_modules/npm/lib/x'] } } },
      3, 1,
    )
    expect(res.code).toBe(0)
  })

  it('exempts the semantic-release toolchain but not a sibling package', () => {
    const plugin = runFilter(
      { vulnerabilities: { sr: { severity: 'high', nodes: ['node_modules/semantic-release/x'] } } },
      3, 1,
    )
    expect(plugin.code).toBe(0)

    const sibling = runFilter(
      { vulnerabilities: { srf: { severity: 'high', nodes: ['node_modules/semantic-release-foo/x'] } } },
      3, 1,
    )
    expect(sibling.code).toBe(2)
  })

  it('fails a mixed-node advisory when any node is a real dependency', () => {
    const res = runFilter(
      { vulnerabilities: { mix: { severity: 'critical', nodes: ['node_modules/real', 'node_modules/npm'] } } },
      3, 1,
    )
    expect(res.code).toBe(2)
    expect(res.output).toContain('real')
  })

  it('fails closed on an advisory with empty or missing nodes', () => {
    const empty = runFilter({ vulnerabilities: { g: { severity: 'critical', nodes: [] } } }, 3, 1)
    expect(empty.code).toBe(2)

    const missing = runFilter({ vulnerabilities: { anon: { severity: 'high' } } }, 3, 1)
    expect(missing.code).toBe(2)
  })

  it('fails on any severity for the production (--omit=dev) pass', () => {
    const res = runFilter(
      { vulnerabilities: { mod: { severity: 'moderate', nodes: ['node_modules/mod'] } } },
      0, 0,
    )
    expect(res.code).toBe(2)
  })

  it('ignores advisories below the severity floor', () => {
    const res = runFilter(
      { vulnerabilities: { low: { severity: 'low', nodes: ['node_modules/l'] } } },
      3, 1,
    )
    expect(res.code).toBe(0)
  })

  it('treats primitive or array JSON as malformed (exit 1)', () => {
    expect(runFilter(null as unknown as object, 3, 1).code).toBe(1)
    expect(runFilter([] as unknown as object, 3, 1).code).toBe(1)
    // raw primitive JSON "null" is passed as string 'null' via JSON.stringify(null)
    // and also via direct string; both should be exit 1
    const rawNull = (() => {
      try {
        const out = execFileSync('node', [filter, 'null', '3', '1'], { encoding: 'utf8' })
        return { code: 0, output: out }
      } catch (e) {
        const err = e as { status?: number; stdout?: string; stderr?: string }
        return { code: err.status ?? 1, output: `${err.stdout ?? ''}${err.stderr ?? ''}` }
      }
    })()
    expect(rawNull.code).toBe(1)
    expect(rawNull.output).toContain('malformed JSON')
  })

  it('treats non-object vulnerabilities as malformed (exit 1)', () => {
    expect(runFilter({ vulnerabilities: 'garbage' as unknown as object }, 3, 1).code).toBe(1)
    expect(runFilter({ vulnerabilities: [] as unknown as object }, 3, 1).code).toBe(1)
    expect(runFilter({ vulnerabilities: null as unknown as object }, 3, 1).code).toBe(1)
  })
})
