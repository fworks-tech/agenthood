import { describe, it, expect } from 'vitest'
import { changelogSection, parseCommits, latestTag } from '../../../scripts/herald-release.mjs'

describe('herald-release — latestTag', () => {
  it('picks the highest valid semver tag', () => {
    expect(latestTag(['v1.2.0', 'v1.10.0', 'v1.2.9'])).toBe('v1.10.0')
  })

  it('ignores tags that are not stable semver', () => {
    expect(latestTag(['v1.2.0', 'vBROKEN', 'v3.62.0rc1', 'v1.2.3-pre', 'v0.9.0'])).toBe('v1.2.0')
  })

  it('returns null when there are no tags', () => {
    expect(latestTag([])).toBeNull()
    expect(latestTag(['vBROKEN', 'v1.2.3-pre', 'v3.62.0rc1'])).toBeNull()
  })
})

describe('herald-release — changelogSection', () => {
  const notes = '# [3.63.0](https://github.com/fworks-tech/agenthood/compare/v3.62.0...v3.63.0) (2026-09-09)\n\n### Features\n\n* **cli:** add something ([9d0f](https://github.com/fworks-tech/agenthood/commit/9d0f))'

  it('does not duplicate the version H1 (generateNotes already emits it)', () => {
    const section = changelogSection({ notes, version: '3.63.0' })
    const headers = section.match(/^# \[3\.63\.0\]/gm) ?? []
    expect(headers).toHaveLength(1)
  })

  it('normalizes trailing blank lines to exactly the prepending separator', () => {
    const section = changelogSection({ notes: notes + '\n\n\n' })
    expect(section.endsWith('\n\n')).toBe(true)
    expect(section).not.toMatch(/\n{3,}$/)
  })
})

describe('herald-release — parseCommits', () => {
  const raw = [
    'abc1234\nfeat(cli): add helpers↯',
    'def5678\nfix(cli): handle windows paths\n\nbody continues\n↯',
  ].join('')

  it('splits on ordered log separator and maps hash/body', () => {
    const commits = parseCommits(raw)
    expect(commits).toEqual([
      { hash: 'abc1234', message: 'feat(cli): add helpers', gitTags: '' },
      { hash: 'def5678', message: 'fix(cli): handle windows paths\n\nbody continues', gitTags: '' },
    ])
  })

  it('drops empty blocks', () => {
    expect(parseCommits('')).toEqual([])
  })
})
