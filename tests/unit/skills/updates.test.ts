import { describe, it, expect } from 'vitest'
import { classifyUpdate, compareVersions } from '../../../src/skills/updates.ts'
import { diffLines } from '../../../src/skills/lineDiff.ts'

describe('compareVersions (#570)', () => {
  it('orders by major, minor, then patch', () => {
    expect(compareVersions('1.0.0', '1.0.1')).toBeLessThan(0)
    expect(compareVersions('1.2.0', '1.10.0')).toBeLessThan(0)
    expect(compareVersions('2.0.0', '1.9.9')).toBeGreaterThan(0)
    expect(compareVersions('1.0.0', '1.0.0')).toBe(0)
  })

  it('ignores a pre-release suffix when ordering', () => {
    expect(compareVersions('1.0.0-beta.1', '1.0.0')).toBe(0)
  })
})

describe('classifyUpdate (#570, #592)', () => {
  it('reports an older local copy as outdated', () => {
    expect(classifyUpdate({ body: 'b', version: '1.0.0' }, { body: 'b', version: '1.1.0' })).toBe('outdated')
  })

  it('reports a newer local copy as ahead', () => {
    expect(classifyUpdate({ body: 'b', version: '2.0.0' }, { body: 'b', version: '1.1.0' })).toBe('ahead')
  })

  it('reports same version with different content as modified', () => {
    expect(classifyUpdate({ body: 'mine', version: '1.0.0' }, { body: 'theirs', version: '1.0.0' })).toBe('modified')
  })

  it('reports identical copies as up to date, with or without versions', () => {
    expect(classifyUpdate({ body: 'b', version: '1.0.0' }, { body: 'b', version: '1.0.0' })).toBe('up-to-date')
    expect(classifyUpdate({ body: 'b' }, { body: 'b' })).toBe('up-to-date')
  })
})

describe('diffLines (#592)', () => {
  it('marks unchanged, removed and added lines', () => {
    const diff = diffLines('a\nb\nc', 'a\nB\nc')
    expect(diff.filter((line) => line.kind === '-').map((line) => line.text)).toEqual(['b'])
    expect(diff.filter((line) => line.kind === '+').map((line) => line.text)).toEqual(['B'])
    expect(diff.filter((line) => line.kind === ' ').map((line) => line.text)).toEqual(['a', 'c'])
  })

  it('returns one hunk for unrelated files', () => {
    const diff = diffLines('one', 'two')
    expect(diff.some((line) => line.kind === '-')).toBe(true)
    expect(diff.some((line) => line.kind === '+')).toBe(true)
  })
})
