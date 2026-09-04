import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { checkSkillIntegrity, describeIntegrityFailure, recordSkillIntegrityDrift, SkillIntegrityError } from '../../../src/utils/skillIntegrity.ts'
import { createTestContext } from '../../helpers/testContext.ts'
import { contentHash } from '../../../src/utils/hash.ts'

describe('checkSkillIntegrity', () => {
  let dir: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'agenthood-integrity-'))
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  function lockfiles(lock: unknown): void {
    writeFileSync(join(dir, 'agenthood.lock'), JSON.stringify(lock), 'utf8')
  }

  function against(content: string, lockedHash: string) {
    writeFileSync(join(dir, 'SKILL.md'), content, 'utf8')
    lockfiles({ version: 1, members: { 'the-tester': { version: lockedHash } } })
  }

  it('returns clean when the SKILL.md hash matches the lockfile', () => {
    const content = '---\nname: the-tester\n---\nbody'
    against(content, contentHash(content))
    expect(checkSkillIntegrity('the-tester', join(dir, 'SKILL.md'), { lockfilePath: dir })).toBe('clean')
  })

  it('returns drift when the SKILL.md hash differs from the lockfile', () => {
    against('tampered body', contentHash('original body'))
    expect(checkSkillIntegrity('the-tester', join(dir, 'SKILL.md'), { lockfilePath: dir })).toBe('drift')
  })

  it('returns corrupt when the lockfile is not valid JSON', () => {
    writeFileSync(join(dir, 'agenthood.lock'), '{ not json', 'utf8')
    expect(checkSkillIntegrity('the-tester', join(dir, 'SKILL.md'), { lockfilePath: dir })).toBe('corrupt')
  })

  it('returns corrupt when the lockfile is unreadable', () => {
    // a directory in place of the lockfile reads as EISDIR/EPERM
    writeFileSync(join(dir, 'SKILL.md'), 'body', 'utf8')
    mkdirSync(join(dir, 'agenthood.lock'))
    expect(checkSkillIntegrity('the-tester', join(dir, 'SKILL.md'), { lockfilePath: dir })).toBe('corrupt')
  })

  it('is pure: never throws even on drift', () => {
    against('tampered body', contentHash('original body'))
    expect(() => checkSkillIntegrity('the-tester', join(dir, 'SKILL.md'), { lockfilePath: dir })).not.toThrow()
  })

  it('returns no-lockfile when the lockfile is absent', () => {
    writeFileSync(join(dir, 'SKILL.md'), 'body', 'utf8')
    expect(checkSkillIntegrity('the-tester', join(dir, 'SKILL.md'), { lockfilePath: dir })).toBe('no-lockfile')
  })

  it('returns no-lockfile when the lockfile exists but lacks the member entry', () => {
    // attacker deleting a member's entry must degrade to gate-OFF, not clean
    writeFileSync(join(dir, 'SKILL.md'), 'body', 'utf8')
    lockfiles({ version: 1, members: {} })
    expect(checkSkillIntegrity('the-tester', join(dir, 'SKILL.md'), { lockfilePath: dir })).toBe('no-lockfile')
  })

  it('returns missing when the skill file does not exist', () => {
    lockfiles({ version: 1, members: { 'the-tester': { version: contentHash('x') } } })
    expect(checkSkillIntegrity('the-tester', join(dir, 'absent', 'SKILL.md'), { lockfilePath: dir })).toBe('missing')
  })
})

describe('SkillIntegrityError', () => {
  it('carries an actionable drift message', () => {
    const err = new SkillIntegrityError('the-tester', 'drift')
    expect(err.name).toBe('SkillIntegrityError')
    expect(err.message).toMatch(/drifted/i)
    expect(err.message).toMatch(/verify --update-lock/)
  })

  it('carries a distinct corrupt-lockfile message', () => {
    const err = new SkillIntegrityError('the-tester', 'corrupt')
    expect(err.message).toMatch(/corrupt/i)
    expect(err.message).toMatch(/lockfile/i)
  })

  it('labels only no-lockfile as the integrity gate being OFF', () => {
    const noLock = new SkillIntegrityError('the-tester', 'no-lockfile')
    expect(noLock.message).toMatch(/no agenthood\.lock entry/i)
    expect(noLock.message).toMatch(/gate is OFF/i)
    expect(noLock.message).toMatch(/verify/)
  })

  it('does not claim the gate is OFF when the skill file is missing', () => {
    const missing = new SkillIntegrityError('the-tester', 'missing')
    expect(missing.message).toMatch(/is missing on disk/i)
    expect(missing.message).toMatch(/restore the skill file/i)
    expect(missing.message).not.toMatch(/gate is OFF/i)
  })
})

describe('describeIntegrityFailure', () => {
  it('maps each reason to its canonical phrase', () => {
    expect(describeIntegrityFailure('the-tester', 'drift')).toBe('SKILL.md for "the-tester" drifted from agenthood.lock')
    expect(describeIntegrityFailure('the-tester', 'corrupt')).toBe('agenthood.lock for "the-tester" is corrupt')
    expect(describeIntegrityFailure('the-tester', 'no-lockfile')).toBe('no agenthood.lock entry for "the-tester"')
    expect(describeIntegrityFailure('the-tester', 'missing')).toBe('SKILL.md for "the-tester" is missing on disk')
  })
})

describe('recordSkillIntegrityDrift', () => {
  it('records a decision and provenance entry for the drift', async () => {
    const context = createTestContext()
    const record = vi.spyOn(context.memory.decisions, 'record').mockResolvedValue(undefined)
    const track = vi.spyOn(context.memory.provenance, 'track').mockImplementation(async (entry) => ({
      ...entry,
      checksum: 'c',
      sequenceId: 1,
      previousChecksum: 'p',
    }))

    await recordSkillIntegrityDrift(context, 'the-tester')

    expect(record).toHaveBeenCalledTimes(1)
    const decision = record.mock.calls[0][0]
    expect(decision.member).toBe('the-tester')
    expect(decision.tags).toContain('mind-virus')
    expect(decision.outcome).toBe('warning')

    expect(track).toHaveBeenCalledTimes(1)
    const entry = track.mock.calls[0][0]
    expect(entry.entityType).toBe('skill-integrity-check')
    expect(entry.agentId).toBe('the-tester')
  })

  it('never throws when the stores fail', async () => {
    const context = createTestContext()
    vi.spyOn(context.memory.decisions, 'record').mockRejectedValue(new Error('disk full'))
    vi.spyOn(context.memory.provenance, 'track').mockRejectedValue(new Error('quota exceeded'))

    await expect(recordSkillIntegrityDrift(context, 'the-tester')).resolves.toBeUndefined()
  })
})
