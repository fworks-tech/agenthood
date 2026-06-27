import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('node:child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:child_process')>()
  return {
    ...actual,
    execSync: vi.fn(),
  }
})

import { execSync } from 'node:child_process'
import { DiffImpactAnalyzer } from '../../../src/workflows/DiffImpactAnalyzer.js'

describe('DiffImpactAnalyzer', () => {
  let analyzer: DiffImpactAnalyzer

  beforeEach(() => {
    analyzer = new DiffImpactAnalyzer()
    vi.mocked(execSync).mockReset()
  })

  it('classifies a simple modified file', () => {
    vi.mocked(execSync)
      .mockReturnValueOnce('10\t5\tsrc/commands/verify.ts\n')
      .mockReturnValueOnce('M\tsrc/commands/verify.ts\n')

    const result = analyzer.analyze('main', 'HEAD')

    expect(result.files).toHaveLength(1)
    expect(result.files[0].path).toBe('src/commands/verify.ts')
    expect(result.files[0].additions).toBe(10)
    expect(result.files[0].deletions).toBe(5)
    expect(result.totalAdditions).toBe(10)
    expect(result.totalDeletions).toBe(5)
  })

  it('classifies added and deleted files', () => {
    vi.mocked(execSync)
      .mockReturnValueOnce('20\t0\tsrc/new.ts\n0\t15\tsrc/old.ts\n')
      .mockReturnValueOnce('A\tsrc/new.ts\nD\tsrc/old.ts\n')

    const result = analyzer.analyze()

    expect(result.files).toHaveLength(2)
    expect(result.files[0].status).toBe('added')
    expect(result.files[0].path).toBe('src/new.ts')
    expect(result.files[1].status).toBe('deleted')
    expect(result.files[1].path).toBe('src/old.ts')
  })

  it('detects affected areas', () => {
    vi.mocked(execSync)
      .mockReturnValueOnce('5\t0\tsrc/commands/foo.ts\n3\t0\tsrc/memory/bar.ts\n')
      .mockReturnValueOnce('M\tsrc/commands/foo.ts\nM\tsrc/memory/bar.ts\n')

    const result = analyzer.analyze()

    expect(result.affectedAreas).toContain('cli')
    expect(result.affectedAreas).toContain('memory')
  })

  it('suggests reviewers based on affected areas', () => {
    vi.mocked(execSync)
      .mockReturnValueOnce('1\t0\tsrc/commands/foo.ts\n')
      .mockReturnValueOnce('M\tsrc/commands/foo.ts\n')

    const result = analyzer.analyze()

    expect(result.suggestedReviewers).toContain('the-doorman')
    expect(result.suggestedReviewers).toContain('the-steward')
  })

  it('returns high risk for core changes', () => {
    vi.mocked(execSync)
      .mockReturnValueOnce('1\t0\tsrc/core/types.ts\n')
      .mockReturnValueOnce('M\tsrc/core/types.ts\n')

    const result = analyzer.analyze()

    expect(result.riskLevel).toBe('high')
  })

  it('marks changes to core types as breaking', () => {
    vi.mocked(execSync)
      .mockReturnValueOnce('1\t0\tsrc/core/types.ts\n')
      .mockReturnValueOnce('M\tsrc/core/types.ts\n')

    const result = analyzer.analyze()

    expect(result.breaking).toBe(true)
  })

  it('marks package.json changes as breaking', () => {
    vi.mocked(execSync)
      .mockReturnValueOnce('1\t0\tpackage.json\n')
      .mockReturnValueOnce('M\tpackage.json\n')

    const result = analyzer.analyze()

    expect(result.breaking).toBe(true)
  })

  it('returns low risk for small non-critical changes', () => {
    vi.mocked(execSync)
      .mockReturnValueOnce('3\t0\ttests/unit/foo.test.ts\n')
      .mockReturnValueOnce('M\ttests/unit/foo.test.ts\n')

    const result = analyzer.analyze()

    expect(result.riskLevel).toBe('low')
  })

  it('returns low risk for docs changes', () => {
    vi.mocked(execSync)
      .mockReturnValueOnce('10\t0\tdocs/readme.md\n')
      .mockReturnValueOnce('M\tdocs/readme.md\n')

    const result = analyzer.analyze()

    expect(result.riskLevel).toBe('low')
  })

  it('handles empty diff gracefully', () => {
    vi.mocked(execSync)
      .mockReturnValueOnce('\n')
      .mockReturnValueOnce('\n')

    const result = analyzer.analyze()

    expect(result.files).toHaveLength(0)
    expect(result.totalFiles).toBe(0)
    expect(result.riskLevel).toBe('low')
  })
})
