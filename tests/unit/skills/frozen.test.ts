import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { checkFrozen, reportFrozenFailure, assertFrozenInstall, type FrozenReport } from '../../../src/skills/frozen.ts'
import { contentHash } from '../../../src/utils/hash.ts'

let dir: string

function writeSkill(name: string, body: string): void {
  const skillDir = join(dir, '.agenthood', 'skills', name)
  mkdirSync(skillDir, { recursive: true })
  writeFileSync(join(skillDir, 'SKILL.md'), `---\nname: ${name}\ndescription: A probe\n---\n${body}`)
}

/**
 * contentHash is the SHA-256 of SKILL.md at install time — the same hash
 * `agenthood verify` locks for members. Callers pass the expected body so the
 * fixture and the lockfile agree by construction.
 */
function writeSkillsLock(skills: Record<string, { source: string; body?: string }>): void {
  const lock = {
    version: 1,
    skills: Object.fromEntries(
      Object.entries(skills).map(([name, s]) => [
        name,
        {
          source: s.source,
          ...(s.body !== undefined ? { contentHash: contentHash(`---\nname: ${name}\ndescription: A probe\n---\n${s.body}`) } : {}),
          installedAt: '2026-10-08T00:00:00.000Z',
        },
      ]),
    ),
  }
  writeFileSync(join(dir, '.agenthood', 'skills', 'skills-lock.json'), JSON.stringify(lock, null, 2))
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'agenthood-frozen-'))
  mkdirSync(join(dir, '.agenthood', 'skills'), { recursive: true })
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

describe('checkFrozen', () => {
  it('reports ok when every locked skill is present and unmodified', () => {
    writeSkill('alpha', 'original')
    writeSkillsLock({ alpha: { source: 'https://example.com/alpha', body: 'original' } })
    const report = checkFrozen(dir, [])
    expect(report.ok).toBe(true)
    expect(report.problems).toHaveLength(0)
  })

  it('reports a missing lockfile', () => {
    const report = checkFrozen(dir, ['beta'])
    expect(report.ok).toBe(false)
    expect(report.problems[0]).toContain('skills-lock.json')
  })

  it('reports a locked skill whose file drifted from its locked hash', () => {
    writeSkill('alpha', 'tampered')
    writeSkillsLock({ alpha: { source: 'https://example.com/alpha', body: 'original' } })
    const report = checkFrozen(dir, [])
    expect(report.ok).toBe(false)
    expect(report.problems[0]).toContain('alpha')
  })

  it('reports a locked skill whose directory is gone', () => {
    writeSkillsLock({ alpha: { source: 'https://example.com/alpha', body: 'original' } })
    const report = checkFrozen(dir, [])
    expect(report.ok).toBe(false)
    expect(report.problems[0]).toContain('alpha')
  })

  it('reports a skill the lockfile has never seen', () => {
    writeSkill('gamma', 'unlocked')
    writeSkill('alpha', 'original')
    writeSkillsLock({ alpha: { source: 'https://example.com/alpha', body: 'original' } })
    const report = checkFrozen(dir, ['gamma'])
    expect(report.ok).toBe(false)
    expect(report.problems[0]).toContain('gamma')
  })

  it('reports every problem, not just the first', () => {
    writeSkill('gamma', 'unlocked')
    writeSkillsLock({ alpha: { source: 'https://example.com/alpha', body: 'original' } })
    const report = checkFrozen(dir, ['gamma'])
    expect(report.problems).toHaveLength(2)
  })

  it('accepts an entry with no locked version and only checks presence', () => {
    // Pre-#604 locks carry no version; refusing those would break every install
    // made before the checksum existed.
    writeSkill('alpha', 'anything at all')
    writeSkillsLock({ alpha: { source: 'https://example.com/alpha' } })
    expect(checkFrozen(dir, []).ok).toBe(true)
  })

  it('ignores member skills when only user skills are checked', () => {
    writeSkill('the-scribe', 'member copy')
    writeSkillsLock({ alpha: { source: 'https://example.com/alpha', body: 'original' } })
    writeSkill('alpha', 'original')
    const report = checkFrozen(dir, [])
    expect(report.ok).toBe(true)
    expect(report.problems.some((p) => p.includes('the-scribe'))).toBe(false)
  })

  it('tolerates a corrupt lockfile by reporting it rather than throwing', () => {
    writeFileSync(join(dir, '.agenthood', 'skills', 'skills-lock.json'), '{ not json')
    const report = checkFrozen(dir, [])
    expect(report.ok).toBe(false)
    expect(report.problems[0]).toContain('skills-lock.json')
  })
})

describe('reportFrozenFailure', () => {
  it('names every problem and the resolution path', () => {
    const report: FrozenReport = {
      ok: false,
      problems: ['alpha drifted from its locked hash', 'gamma is not in skills-lock.json'],
    }
    const out: string[] = []
    const spy = vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
      out.push(args.map(String).join(' '))
    })
    const exit = vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('exited')
    }) as never)
    expect(() => reportFrozenFailure(report)).toThrow('exited')
    expect(out.join('\n')).toContain('alpha drifted')
    expect(out.join('\n')).toContain('gamma')
    expect(out.join('\n')).toContain('agenthood install')
    spy.mockRestore()
    exit.mockRestore()
  })
})

describe('assertFrozenInstall', () => {
  it('passes when fetched hash matches locked version and no other drift', () => {
    writeSkill('alpha', 'original')
    writeSkillsLock({ alpha: { source: 'https://example.com/alpha', body: 'original' } })
    const fetchedHash = contentHash('---\nname: alpha\ndescription: A probe\n---\noriginal')
    const report = assertFrozenInstall(dir, 'https://example.com/alpha', 'alpha', fetchedHash)
    expect(report.ok).toBe(true)
  })

  it('fails when lockfile is missing', () => {
    const report = assertFrozenInstall(dir, 'https://example.com/beta', 'beta', 'any-hash')
    expect(report.ok).toBe(false)
    expect(report.problems[0]).toContain('skills-lock.json not found')
  })

  it('fails when requested skill is not in lockfile', () => {
    writeSkillsLock({ alpha: { source: 'https://example.com/alpha', body: 'original' } })
    const report = assertFrozenInstall(dir, 'https://example.com/beta', 'beta', 'any-hash')
    expect(report.ok).toBe(false)
    expect(report.problems[0]).toContain('beta')
    expect(report.problems[0]).toContain('not in')
  })

  it('fails when locked source differs from requested source', () => {
    writeSkillsLock({ alpha: { source: 'https://example.com/alpha', body: 'original' } })
    const fetchedHash = contentHash('---\nname: alpha\ndescription: A probe\n---\noriginal')
    const report = assertFrozenInstall(dir, 'https://other.com/alpha', 'alpha', fetchedHash)
    expect(report.ok).toBe(false)
    expect(report.problems[0]).toContain('locked from')
  })

  it('fails when fetched hash does not match locked version', () => {
    writeSkillsLock({ alpha: { source: 'https://example.com/alpha', body: 'original' } })
    const report = assertFrozenInstall(dir, 'https://example.com/alpha', 'alpha', 'wrong-hash')
    expect(report.ok).toBe(false)
    expect(report.problems[0]).toContain('fetched hash does not match')
  })

  it('fails when locked entry has no version (pre-#604 lock)', () => {
    writeSkillsLock({ alpha: { source: 'https://example.com/alpha' } })
    const report = assertFrozenInstall(dir, 'https://example.com/alpha', 'alpha', 'any-hash')
    expect(report.ok).toBe(false)
    expect(report.problems[0]).toContain('no locked checksum')
  })

  it('detects drift in other locked skills present on disk', () => {
    writeSkill('alpha', 'original')
    writeSkill('beta', 'tampered')
    writeSkillsLock({
      alpha: { source: 'https://example.com/alpha', body: 'original' },
      beta: { source: 'https://example.com/beta', body: 'original' },
    })
    const fetchedHash = contentHash('---\nname: alpha\ndescription: A probe\n---\noriginal')
    const report = assertFrozenInstall(dir, 'https://example.com/alpha', 'alpha', fetchedHash)
    expect(report.ok).toBe(false)
    // The message includes quotes around the skill name: '"beta" drifted...'
    expect(report.problems.some((p) => p.includes('beta') && p.includes('drifted'))).toBe(true)
  })

  it('ignores missing skills on disk (fresh checkout)', () => {
    // beta is locked but not installed yet — this is normal for a fresh clone
    writeSkillsLock({
      alpha: { source: 'https://example.com/alpha', body: 'original' },
      beta: { source: 'https://example.com/beta', body: 'original' },
    })
    writeSkill('alpha', 'original')
    const fetchedHash = contentHash('---\nname: alpha\ndescription: A probe\n---\noriginal')
    const report = assertFrozenInstall(dir, 'https://example.com/alpha', 'alpha', fetchedHash)
    expect(report.ok).toBe(true)
  })
})
