import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { rawSpecs } from '../../../src/members/member-specs.ts'

const skillPath = fileURLToPath(new URL('../../../skills/the-sentinel/SKILL.md', import.meta.url))

describe('lane map parity', () => {
  it('rawSpecs.ownedDecisions mirrors the SKILL.md lane map', () => {
    const md = readFileSync(skillPath, 'utf8')
    const table = md.match(/\| The Strategist \|[\s\S]*?\| The Mailman \|.*\|/)?.[0]
    expect(table, 'lane map table not found').toBeDefined()

    const mdEntries = new Map<string, string[]>()
    for (const line of (table ?? '').split('\n')) {
      const cells = line.split('|').map((c) => c.trim())
      if (cells.length < 5 || !cells[1]) continue
      const member = cells[1].toLowerCase().replace(/\s+/g, '-')
      const decisions = cells[3].split(',').map((d) => d.trim()).filter(Boolean)
      mdEntries.set(member, decisions)
    }

    expect(mdEntries.size).toBe(rawSpecs.length)
    for (const spec of rawSpecs) {
      expect(mdEntries.get(spec.name), `${spec.name} missing from SKILL.md lane map`).toBeDefined()
      const fromSpec = spec.ownedDecisions.map((d) => d.toLowerCase()).sort()
      const fromMd = mdEntries.get(spec.name)!.map((d) => d.toLowerCase()).sort()
      expect(fromSpec).toEqual(fromMd)
    }
  })
})
