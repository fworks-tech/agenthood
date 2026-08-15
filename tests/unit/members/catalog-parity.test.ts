import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { MemberRegistry } from '../../../src/members/MemberRegistry.ts'

const repoRoot = join(import.meta.dirname, '..', '..', '..')

function catalogNames(filePath: string): Set<string> {
  const content = readFileSync(filePath, 'utf8')
  const names = new Set<string>()
  for (const match of content.matchAll(/the-[a-z]+/g)) {
    names.add(match[0])
  }
  return names
}

describe('Member catalog parity', () => {
  const registry = new MemberRegistry()
  const registered = registry.list().map((s) => s.name)

  const catalogs = [
    { file: join(repoRoot, 'README.md'), label: 'README.md' },
    { file: join(repoRoot, 'docs', 'members', 'README.md'), label: 'docs/members/README.md' },
    { file: join(repoRoot, 'AGENTS.md'), label: 'AGENTS.md' },
    { file: join(repoRoot, '.claude-plugin', 'marketplace.json'), label: 'marketplace.json' },
  ]

  it('every registered member appears in every user-facing catalog', () => {
    for (const { file, label } of catalogs) {
      const names = catalogNames(file)
      const missing = registered.filter((name) => !names.has(name))
      expect(missing, `${label} is missing members: ${missing.join(', ')}`).toEqual([])
    }
  })

  it('catalogs do not list members that are not registered', () => {
    for (const { file, label } of catalogs) {
      const names = catalogNames(file)
      const unknown = Array.from(names).filter((name) => !registered.includes(name))
      expect(unknown, `${label} lists unregistered members: ${unknown.join(', ')}`).toEqual([])
    }
  })
})
