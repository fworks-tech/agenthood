import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { updateLockfile } from '../../../src/utils/lockfile.ts'

describe('updateLockfile', () => {
  let cwd: string

  beforeEach(() => {
    cwd = mkdtempSync(join(tmpdir(), 'agenthood-lock-'))
  })

  afterEach(() => {
    rmSync(cwd, { recursive: true, force: true })
  })

  it('refuses to rebuild a lockfile it cannot parse', () => {
    writeFileSync(join(cwd, 'agenthood.lock'), '{ not json')
    expect(() => updateLockfile(cwd, join(cwd, 'members'), ['scribe'])).toThrow(/not valid JSON/)
  })

  it('writes a fresh lockfile when none exists', () => {
    const membersDir = join(cwd, 'members')
    mkdirSync(join(membersDir, 'scribe'), { recursive: true })
    writeFileSync(join(membersDir, 'scribe', 'SKILL.md'), '---\nname: scribe\n---\nbody\n')
    updateLockfile(cwd, membersDir, ['scribe'])
    const lock = JSON.parse(readFileSync(join(cwd, 'agenthood.lock'), 'utf8'))
    expect(lock.members.scribe.version).toMatch(/^[a-f0-9]{64}$/)
  })
})
