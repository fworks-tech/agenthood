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

describe('utility skill page coverage', () => {
  const page = readFileSync(join(repoRoot, 'docs', 'academy', 'utility-skills.md'), 'utf8')
  const documented = [...page.matchAll(/^\*\*File:\*\* \[`skills\/([a-z0-9-]+)\/SKILL\.md`\]/gm)].map(
    (match) => match[1],
  )

  it('gives every utility skill exactly one File link, and no other skill', () => {
    const missing = utilitySkills.filter((name) => !documented.includes(name))
    const extra = documented.filter((name) => !utilitySkills.includes(name))
    const duplicates = documented.filter((name, index) => documented.indexOf(name) !== index)
    expect({ missing, extra, duplicates }).toEqual({ missing: [], extra: [], duplicates: [] })
  })
})
