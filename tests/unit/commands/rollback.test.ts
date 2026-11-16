import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { findVersionRevision } from '../../../src/commands/rollback.ts'

const skill = (version: string) => `---\nname: scribe\ndescription: d\nlicense: MIT\nmetadata:\n  version: ${version}\n---\nBody ${version}.\n`

describe('rollback --version (#591)', () => {
  let repo: string
  const skillPath = 'skills/scribe/SKILL.md'

  const commit = (version: string) => {
    writeFileSync(join(repo, skillPath), skill(version))
    execFileSync('git', ['add', '-A'], { cwd: repo })
    execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-qm', `v${version}`], { cwd: repo })
    return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repo, encoding: 'utf-8' }).trim()
  }

  beforeEach(() => {
    repo = mkdtempSync(join(tmpdir(), 'rollback-version-'))
    execFileSync('git', ['init', '-q'], { cwd: repo })
    mkdirSync(join(repo, 'skills', 'scribe'), { recursive: true })
  })

  afterEach(() => {
    rmSync(repo, { recursive: true, force: true })
  })

  it('finds the commit that declared the requested version', () => {
    const first = commit('1.0.0')
    commit('1.1.0')

    expect(findVersionRevision(repo, skillPath, '1.0.0')).toBe(first)
  })

  it('returns the newest commit that declared a version restored later', () => {
    commit('1.0.0')
    commit('1.1.0')
    const latest = commit('1.0.0')

    expect(findVersionRevision(repo, skillPath, '1.0.0')).toBe(latest)
  })

  it('returns null for a version the history never had', () => {
    commit('1.0.0')
    expect(findVersionRevision(repo, skillPath, '9.9.9')).toBeNull()
  })
})
