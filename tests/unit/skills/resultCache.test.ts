import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import {
  readCacheStats,
  readCachedOutput,
  recordCacheResult,
  resultCacheKey,
  writeCachedOutput,
} from '../../../src/skills/execution/resultCache.ts'

let dir: string

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'result-cache-'))
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

describe('result cache (#598)', () => {
  it('misses when nothing was stored', () => {
    expect(readCachedOutput(dir, resultCacheKey('s', 'a.js', [], 'digest'), 1000)).toBeUndefined()
  })

  it('serves a stored output inside the TTL and misses after it', () => {
    const key = resultCacheKey('s', 'a.js', ['--x'], 'digest')
    const now = 1_000_000
    writeCachedOutput(dir, key, 'output', now)
    expect(readCachedOutput(dir, key, 500, now + 400)).toBe('output')
    expect(readCachedOutput(dir, key, 500, now + 600)).toBeUndefined()
  })

  it('keys on the script digest and the arguments', () => {
    const base = resultCacheKey('s', 'a.js', [], 'digest-1')
    expect(resultCacheKey('s', 'a.js', [], 'digest-2')).not.toBe(base)
    expect(resultCacheKey('s', 'a.js', ['--x'], 'digest-1')).not.toBe(base)
    expect(resultCacheKey('other', 'a.js', [], 'digest-1')).not.toBe(base)
  })

  it('reports entries and a hit rate', () => {
    const key = resultCacheKey('s', 'a.js', [], 'digest')
    writeCachedOutput(dir, key, 'output')
    recordCacheResult(dir, true)
    recordCacheResult(dir, false)
    recordCacheResult(dir, true)
    const stats = readCacheStats(dir)
    expect(stats.entries).toBe(1)
    expect(stats.hits).toBe(2)
    expect(stats.misses).toBe(1)
    expect(stats.hitRate).toBeCloseTo(2 / 3)
  })
})
