import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { rawSpecs } from '../../../src/members/member-specs.ts'

const repoRoot = join(import.meta.dirname, '..', '..', '..')

const memberNames = new Set(rawSpecs.map((spec) => spec.name))
const utilitySkills = readdirSync(join(repoRoot, 'skills'), { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && entry.name !== '_shared' && !memberNames.has(entry.name))
  .map((entry) => entry.name)

const readme = readFileSync(join(repoRoot, 'README.md'), 'utf8')

describe('utility skill count in README', () => {
  it('states the measured count in the overview', () => {
    const claimed = readme.match(/(\d+) utility skills/)
    expect(claimed, 'README must state "<N> utility skills"').not.toBeNull()
    expect(Number(claimed![1])).toBe(utilitySkills.length)
  })

  it('states the same count in the reading list', () => {
    expect(readme).toContain(`the ${utilitySkills.length} specialist skills`)
  })
})
