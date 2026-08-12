import { describe, it, expect } from 'vitest'
import { findLaneOverlaps } from '../../../src/members/laneOverlap.ts'
import { rawSpecs } from '../../../src/members/member-specs.ts'
import type { RawSpec } from '../../../src/members/member-specs.ts'

function spec(name: string, ownedDecisions: string[]): RawSpec {
  return {
    name,
    description: '',
    tagline: '',
    category: 'engineering',
    permissionProfile: 'standard',
    preferredProvider: 'anthropic',
    ownedDecisions,
  }
}

describe('findLaneOverlaps', () => {
  it('finds pairs sharing decision vocabulary', () => {
    const overlaps = findLaneOverlaps([
      spec('the-a', ['Commit messages', 'changelogs']),
      spec('the-b', ['changelogs', 'Release notes']),
    ])
    expect(overlaps).toHaveLength(1)
    expect(overlaps[0]).toEqual({ a: 'the-a', b: 'the-b', shared: ['changelogs'] })
  })

  it('ignores case and punctuation', () => {
    const overlaps = findLaneOverlaps([
      spec('the-a', ['Pixel-level analysis!']),
      spec('the-b', ['Pixel Level Analysis']),
    ])
    expect(overlaps[0].shared).toEqual(['analysis', 'level', 'pixel'])
  })

  it('treats stopwords as non-significant', () => {
    expect(findLaneOverlaps([
      spec('the-a', ['Task routing']),
      spec('the-b', ['Task management']),
    ])).toHaveLength(0)
  })

  it('reports no overlaps for the canonical lane map', () => {
    expect(findLaneOverlaps(rawSpecs)).toEqual([])
  })
})
