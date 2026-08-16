import { describe, it, expect } from 'vitest'
import { findTestFilesForSource, getTestFiles, rejectFlagLikePaths } from '../../../scripts/test-changed.mjs'

const fakeIndex = new Map([
  ['utils', ['tests/unit/utils/format.test.ts']],
  ['other', ['tests/other/format.test.ts']],
  ['agents', ['tests/unit/agents/BaseAgent.lifecycle.test.ts']],
  ['agents/base', ['tests/unit/agents/base/BaseAgent.test.ts']],
  ['.', ['tests/commitlint.test.ts']],
])

describe('findTestFilesForSource', () => {
  it('matches a test in the same relative directory', () => {
    expect(findTestFilesForSource('src/utils/format.ts', fakeIndex)).toEqual([
      'tests/unit/utils/format.test.ts',
    ])
  })

  it('never matches the same basename from an unrelated module', () => {
    expect(findTestFilesForSource('src/utils/format.ts', fakeIndex)).not.toContain(
      'tests/other/format.test.ts',
    )
  })

  it('matches a test in an ancestor test directory (src/agents/base → tests/unit/agents)', () => {
    expect(findTestFilesForSource('src/agents/base/BaseAgent.ts', fakeIndex)).toEqual([
      'tests/unit/agents/BaseAgent.lifecycle.test.ts',
      'tests/unit/agents/base/BaseAgent.test.ts',
    ])
  })

  it('returns an empty list when no test shares the basename', () => {
    expect(findTestFilesForSource('src/cli.ts', fakeIndex)).toEqual([])
  })

  it('returns an empty list for a file without a basename', () => {
    expect(findTestFilesForSource('.ts', fakeIndex)).toEqual([])
  })
})

describe('getTestFiles', () => {
  it('skips test files themselves', () => {
    expect(getTestFiles(['tests/unit/utils/format.test.ts'], fakeIndex)).toEqual([])
  })

  it('skips non-TypeScript files', () => {
    expect(getTestFiles(['README.md', 'docs/architecture/agent-system.md'], fakeIndex)).toEqual([])
  })

  it('deduplicates matching tests across fallback paths', () => {
    const files = getTestFiles(['src/agents/base/BaseAgent.ts', 'src/agents/base/BaseAgent.ts'], fakeIndex)
    expect(files).toHaveLength(2)
    expect(new Set(files).size).toBe(2)
  })

  it('finds real tests for a changed source file in this repo', () => {
    const files = getTestFiles(['src/agents/base/BaseAgent.ts'])
    expect(files).toContain('tests/unit/agents/BaseAgent.lifecycle.test.ts')
  })
})

describe('rejectFlagLikePaths', () => {
  it('passes ordinary paths through unchanged', () => {
    expect(rejectFlagLikePaths(['tests/unit/utils/format.test.ts'])).toEqual([
      'tests/unit/utils/format.test.ts',
    ])
  })

  it('rejects a path that would parse as a CLI flag', () => {
    expect(() => rejectFlagLikePaths(['-c', 'tests/unit/utils/format.test.ts'])).toThrow(
      /flag-like paths/,
    )
  })
})
