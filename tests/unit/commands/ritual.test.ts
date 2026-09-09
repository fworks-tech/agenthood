import { describe, it, expect } from 'vitest'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parseFrontmatter, loadRituals, command } from '../../../src/commands/ritual.ts'

const MORNING = [
  '---',
  'name: morning-briefing',
  'schedule: "0 8 * * 1-5"',
  'priority: SCHEDULED',
  'member: the-herald',
  'description: Daily 8am standup generated from git activity, open PRs, and idle work detection.',
  '---',
  '',
  '# Ritual: Morning Briefing',
].join('\n')

const WATCHMAN = [
  '---',
  "schedule: '0 */2 * * *'",
  'priority: BACKGROUND',
  'member: the-doorman',
  'name: the-watchman',
  'description: Every 2 hours, checks for uncommitted changes sitting idle and branches drifting from main.',
  '---',
  '',
  '# Ritual: The Watchman',
].join('\n')

describe('parseFrontmatter', () => {
  it('parses quoted and unquoted values', () => {
    const fields = parseFrontmatter(MORNING)
    expect(fields.name).toBe('morning-briefing')
    expect(fields.schedule).toBe('0 8 * * 1-5')
    expect(fields.priority).toBe('SCHEDULED')
    expect(fields.member).toBe('the-herald')
  })

  it('returns an empty object without frontmatter', () => {
    expect(parseFrontmatter('# Ritual\n\nno manifest here')).toEqual({})
  })
})

describe('loadRituals', () => {
  it('loads sorted manifests and ignores non-manifest files', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rituals-'))
    writeFileSync(join(dir, 'the-watchman.md'), WATCHMAN)
    writeFileSync(join(dir, 'morning-briefing.md'), MORNING)
    writeFileSync(join(dir, 'README.md'), 'no frontmatter in here')

    const rituals = loadRituals(dir)
    expect(rituals.map((r) => r.name)).toEqual(['morning-briefing', 'the-watchman'])
    expect(rituals[0].file).toBe('morning-briefing.md')
    expect(rituals[1].priority).toBe('BACKGROUND')
  })

  it('skips manifests missing required fields', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rituals-'))
    writeFileSync(join(dir, 'incomplete.md'), '---\nname: incomplete\n---\n')
    writeFileSync(join(dir, 'morning-briefing.md'), MORNING)
    expect(loadRituals(dir).map((r) => r.name)).toEqual(['morning-briefing'])
  })

  it('returns an empty list when the directory does not exist', () => {
    expect(loadRituals(join(tmpdir(), 'does-not-exist-rituals'))).toEqual([])
  })
})

describe('ritual command', () => {
  it('is registered as ritual', () => {
    expect(command.name).toBe('ritual')
    expect(typeof command.handler).toBe('function')
  })
})
