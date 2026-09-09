import { describe, it, expect } from 'vitest'
import { findConflicts, tokenize, OVERLAP_THRESHOLD } from '../../../src/skills/conflicts.ts'

const LONG_A = 'Reviews pull requests for correctness, security, and readability before merging; runs multi-axis review on any diff'
const LONG_A_DUPLICATE = 'Reviews pull requests for correctness, security, readability before merging; runs multi-axis review on any diff quickly'
const LONG_B = 'Writes conventional commit messages, PR descriptions, and changelogs from diffs and branch history'
const SHORT = 'Test helper for specs'

describe('tokenize', () => {
  it('lowercases, strips punctuation, drops stop words and short tokens', () => {
    expect(tokenize('Use when the User asks to Review PRs!')).toEqual(new Set(['review', 'prs']))
  })
})

describe('findConflicts', () => {
  it('flags near-identical descriptions above the threshold', () => {
    const conflicts = findConflicts([
      { name: 'reviewer', description: LONG_A },
      { name: 'reviewer-clone', description: LONG_A_DUPLICATE },
    ])
    expect(conflicts).toHaveLength(1)
    expect(conflicts[0].a).toBe('reviewer')
    expect(conflicts[0].b).toBe('reviewer-clone')
    expect(conflicts[0].score).toBeGreaterThan(OVERLAP_THRESHOLD)
    expect(conflicts[0].shared.length).toBeGreaterThan(0)
    expect(conflicts[0].resolution).toMatch(/remove|specialize/)
  })

  it('does not flag unrelated descriptions', () => {
    expect(findConflicts([
      { name: 'reviewer', description: LONG_A },
      { name: 'scribe', description: LONG_B },
    ])).toHaveLength(0)
  })

  it('does not flag short descriptions (false-positive guard)', () => {
    expect(findConflicts([
      { name: 'a', description: 'run the test suite' },
      { name: 'b', description: 'run the test suite' },
    ])).toHaveLength(0)
  })

  it('ignores shared boilerplate between distinct skills', () => {
    const boilerplate = 'Triggers when the session starts, routes tasks, manages context capacity'
    expect(findConflicts([
      { name: 'steward', description: `${boilerplate} with provider cache strategy` },
      { name: 'mediator', description: `${boilerplate} by classifying intent first` },
    ])).toHaveLength(0)
  })

  it('suggests removal for a subset description and specialization otherwise', () => {
    const base = 'Audits dependencies for known vulnerabilities and risks before merging'
    const subset = 'Audits dependencies for known vulnerabilities before merging'
    const [hit] = findConflicts([
      { name: 'auditor', description: base },
      { name: 'dep-check', description: subset },
    ])
    expect(hit.score).toBeGreaterThan(OVERLAP_THRESHOLD)
    expect(hit.resolution).toMatch(/contained in the other/)

    const partialA = 'Manages releases, semantic versioning, changelog generation, scheduled reports, and git operations digests'
    const partialB = 'Manages releases, semantic versioning, changelog generation, scheduled reports, and git operations announcements'
    const [hit2] = findConflicts([
      { name: 'librarian', description: partialA },
      { name: 'doc-writer', description: partialB },
    ])
    expect(hit2.score).toBeGreaterThan(OVERLAP_THRESHOLD)
    expect(hit2.resolution).toMatch(/near-duplicate/)
  })

  it('sorts conflicts by descending score', () => {
    const result = findConflicts([
      { name: 'herald', description: 'Manages releases, semantic versioning, changelog generation, and scheduled reports' },
      { name: 'scribe', description: 'Writes commit messages, changelogs, and release notes' },
      { name: 'herald-clone', description: 'Manages releases, semantic versioning, changelog generation, and scheduled reports automatically' },
      { name: 'scribe-clone', description: 'Writes commit messages, changelogs, and release notes descriptions' },
    ])
    expect(result).toHaveLength(2)
    expect(result[0].score).toBeGreaterThan(result[1].score)
    expect(result.map((c) => `${c.a}/${c.b}`).sort()).toEqual(['herald/herald-clone', 'scribe/scribe-clone'])
  })

  it('respects a stricter custom threshold', () => {
    const skills = [
      { name: 'reviewer', description: LONG_A },
      { name: 'reviewer-clone', description: LONG_A_DUPLICATE },
    ]
    expect(findConflicts(skills, 1)).toHaveLength(0)
  })
})
