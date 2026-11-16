import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

vi.mock('../../../src/utils/skillIntegrity.ts', () => ({ checkSkillIntegrity: () => 'clean' }))

import { discoverSkills } from '../../../src/runtime/contextSetup.ts'

let project: string

beforeEach(() => {
  project = mkdtempSync(join(tmpdir(), 'skill-gate-'))
  const write = (name: string, frontmatter: string) => {
    const dir = join(project, '.agents', 'skills', name)
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, 'SKILL.md'), `---\nname: ${name}\ndescription: ${name} skill\n${frontmatter}---\n# ${name}\nBody`)
  }
  write('opus-only', 'model-targets:\n  provider: anthropic\n')
  write('works-anywhere', '')
})

afterEach(() => {
  rmSync(project, { recursive: true, force: true })
})

describe('discoverSkills gating (#549, #553, #571)', () => {
  it('keeps an unusable skill out of the catalog and still reports why', async () => {
    const { catalog, manifests, blocked } = await discoverSkills(project, {
      provider: 'openai',
      availability: { provider: 'openai', model: 'gpt-4o', contextWindow: 128000 },
    })
    expect(catalog).toContain('works-anywhere')
    expect(catalog).not.toContain('opus-only')
    expect(blocked.get('opus-only')).toContain('requires provider anthropic')
    // Still in the map so activation can refuse with the same reason.
    expect(manifests.has('opus-only')).toBe(true)
  })

  it('lists everything when this run satisfies the requirements', async () => {
    const { catalog, blocked } = await discoverSkills(project, {
      provider: 'anthropic',
      availability: { provider: 'anthropic', model: 'claude-opus-4', contextWindow: 200000 },
    })
    expect(catalog).toContain('opus-only')
    expect(blocked.size).toBe(0)
  })

  it('surfaces optional-gap warnings without blocking', async () => {
    const dir = join(project, '.agents', 'skills', 'warned')
    mkdirSync(dir, { recursive: true })
    writeFileSync(
      join(dir, 'SKILL.md'),
      '---\nname: warned\ndescription: warned skill\nrequires:\n  optional-tools: [jq]\n---\nBody',
    )
    const { warnings, blocked } = await discoverSkills(project, { availability: { tools: [] } })
    expect(blocked.has('warned')).toBe(false)
    expect(warnings.get('warned')?.[0]).toContain('optional tool "jq"')
  })
})
