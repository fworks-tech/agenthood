import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { SEMVER_RE, SkillParser } from '../../../src/skills/discovery/SkillParser.ts'
import { TOOL_VOCABULARY } from '../../../src/members/toolVocabulary.ts'

const repoRoot = join(import.meta.dirname, '..', '..', '..')
const vocabulary = new Set(Object.keys(TOOL_VOCABULARY))
const parser = new SkillParser()

const skills = readdirSync(join(repoRoot, 'skills'), { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && entry.name !== '_shared' && entry.name !== 'contrib')
  .map((entry) => entry.name)

describe('skill frontmatter contract', () => {
  it.each(skills)('%s declares name, description, tools and version', (name) => {
    const file = join(repoRoot, 'skills', name, 'SKILL.md')
    const parsed = parser.parse(file)
    expect(parsed, `${name} must parse`).not.toBeNull()
    expect(parsed!.name).toBe(name)
    expect(parsed!.description.trim()).not.toBe('')

    const raw = parser.parseRaw(readFileSync(file, 'utf8'))
    const metadata = raw.frontmatter?.metadata
    expect(metadata, `${name} needs metadata.version`).toBeTypeOf('object')
    const version = (metadata as Record<string, unknown> | undefined)?.version
    expect(version, `${name} needs metadata.version`).toMatch(SEMVER_RE)

    const tools = parsed!.allowedTools ?? []
    expect(tools.length, `${name} needs allowed-tools`).toBeGreaterThan(0)
    expect(tools.filter((tool) => !vocabulary.has(tool))).toEqual([])
  })
})
