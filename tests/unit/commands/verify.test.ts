import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>()
  return {
    ...actual,
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
  }
})

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { verify } from '../../../src/commands/verify.ts'
import { contentHash } from '../../../src/utils/hash.ts'

const OLD = '2026-01-01T00:00:00.000Z'
const VALID_SKILL = `---
name: the-test
description: A test member
license: MIT
---

# The Test

## Overview

Test overview content.

## When to Use

When testing.

## Process

Test process.

## Red Flags

Test red flags.

## Rationalizations

Test rationalizations.

## Verification

Test verification.
`

const lockWith = (members: Record<string, { version: string; updatedAt: string }>) =>
  JSON.stringify({ version: 1, members })

let skillContent: string
let lockContent: string

beforeEach(() => {
  vi.restoreAllMocks()
  skillContent = VALID_SKILL
  lockContent = lockWith({ 'the-test': { version: contentHash(VALID_SKILL), updatedAt: OLD } })
  vi.mocked(existsSync).mockReturnValue(true)
  vi.mocked(readFileSync).mockClear()
  vi.mocked(writeFileSync).mockClear()
  vi.mocked(writeFileSync).mockReturnValue(undefined)
  vi.mocked(readFileSync).mockImplementation(((p: string) =>
    String(p).endsWith('agenthood.lock') ? lockContent : skillContent
  ) as any)
})

const skillPathsRead = (): string[] =>
  vi.mocked(readFileSync).mock.calls
    .map((c) => String(c[0]))
    .filter((p) => p.endsWith('SKILL.md'))

describe('verify command', () => {
  it('passes valid SKILL.md files', async () => {
    const exit = vi.spyOn(process, 'exit').mockImplementation((() => {}) as any)
    await verify([])
    expect(exit).not.toHaveBeenCalledWith(1)
  })

  it('fails when SKILL.md is missing', async () => {
    vi.mocked(existsSync).mockReturnValue(false)
    const exit = vi.spyOn(process, 'exit').mockImplementation((() => {}) as any)
    await verify([])
    expect(exit).toHaveBeenCalledWith(1)
  })

  it('fails when frontmatter is missing', async () => {
    skillContent = '# No Frontmatter'
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    const exit = vi.spyOn(process, 'exit').mockImplementation((() => {}) as any)
    await verify([])
    expect(exit).toHaveBeenCalledWith(1)
    expect(log.mock.calls.flat().join(' ')).toContain('Missing YAML frontmatter')
  })

  it('fails when required sections are missing', async () => {
    skillContent = '---\nname: the-test\ndescription: test\nlicense: MIT\n---\n\n## Only Overview\n'
    const exit = vi.spyOn(process, 'exit').mockImplementation((() => {}) as any)
    await verify([])
    expect(exit).toHaveBeenCalledWith(1)
  })

  it('fails when placeholder content is present', async () => {
    skillContent = VALID_SKILL.replace('Test verification.', 'TODO: write this later')
    const exit = vi.spyOn(process, 'exit').mockImplementation((() => {}) as any)
    await verify([])
    expect(exit).toHaveBeenCalledWith(1)
  })

  it('accepts --update-lock flag and writes lockfile', async () => {
    await verify(['--update-lock'])
    expect(writeFileSync).toHaveBeenCalled()
  })

  it('detects drift when lockfile hash does not match', async () => {
    lockContent = lockWith({ 'the-test': { version: 'different-hash', updatedAt: OLD } })
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    const exit = vi.spyOn(process, 'exit').mockImplementation((() => {}) as any)
    await verify([])
    expect(exit).toHaveBeenCalledWith(1)
    const output = log.mock.calls.flat().join(' ')
    expect(output).toContain('Drift detected')
    expect(output).toContain('the-test')
  })

  it('--update-lock re-locks a drifted member instead of failing', async () => {
    const h = contentHash(VALID_SKILL)
    lockContent = lockWith({
      'the-test': { version: h, updatedAt: OLD },
      'the-other': { version: 'stale', updatedAt: OLD },
    })
    vi.mocked(readFileSync).mockImplementation(((p: string) =>
      String(p).endsWith('agenthood.lock')
        ? lockContent
        : VALID_SKILL.replace('the-test', String(p).split(/[\\/]/).at(-2) as string)
    ) as any)
    const exit = vi.spyOn(process, 'exit').mockImplementation((() => {}) as any)

    await verify(['--update-lock'])

    expect(exit).not.toHaveBeenCalledWith(1)
    const written = JSON.parse(vi.mocked(writeFileSync).mock.calls.at(-1)![1] as string)
    expect(written.members['the-other'].version).not.toBe('stale')
    expect(written.members['the-other'].updatedAt).not.toBe(OLD)
    expect(written.members['the-test'].version).toBe(h)
    expect(written.members['the-test'].updatedAt).toBe(OLD)
    expect(Object.keys(written.members)).toEqual(['the-other', 'the-test'])
  })

  it('fails when the skill violates the agentskills.io name spec', async () => {
    skillContent = VALID_SKILL.replace('name: the-test', 'name: Bad_Name')
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    const exit = vi.spyOn(process, 'exit').mockImplementation((() => {}) as any)
    await verify([])
    expect(exit).toHaveBeenCalledWith(1)
    expect(log.mock.calls.flat().join(' ')).toContain('name-format')
  })

  it('validates only members tracked in the lockfile (#740)', async () => {
    lockContent = lockWith({ 'the-test': { version: contentHash(VALID_SKILL), updatedAt: OLD } })
    vi.spyOn(process, 'exit').mockImplementation((() => {}) as any)
    await verify([])
    // the members validated are exactly the lockfile's keys, resolved against
    // the canonical society dir — not every subdirectory of skills/.
    const validated = skillPathsRead().map((p) => p.split(/[\\/]/).at(-2) as string)
    expect(validated).toEqual(['the-test'])
    expect(skillPathsRead()[0]).toContain('skills')
  })

  it('--lock-only passes when hashes match and reports OK', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    const exit = vi.spyOn(process, 'exit').mockImplementation((() => {}) as any)
    await verify(['--lock-only'])
    expect(exit).not.toHaveBeenCalledWith(1)
    expect(log.mock.calls.flat().join(' ')).toContain('integrity OK')
  })

  it('--lock-only fails on lock-vs-hash drift', async () => {
    lockContent = lockWith({ 'the-test': { version: 'wrong-hash', updatedAt: OLD } })
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    const exit = vi.spyOn(process, 'exit').mockImplementation((() => {}) as any)
    await verify(['--lock-only'])
    expect(exit).toHaveBeenCalledWith(1)
    expect(log.mock.calls.flat().join(' ')).toContain('Lockfile drift')
  })

  it('--lock-only ignores placeholder prose that full verify flags', async () => {
    skillContent = VALID_SKILL.replace('Test verification.', 'TODO: fill in later')
    lockContent = lockWith({ 'the-test': { version: contentHash(skillContent), updatedAt: OLD } })
    const exit = vi.spyOn(process, 'exit').mockImplementation((() => {}) as any)
    await verify(['--lock-only'])
    expect(exit).not.toHaveBeenCalledWith(1) // hash matches, prose not checked
    await verify([])
    expect(exit).toHaveBeenCalledWith(1) // full verify rejects the placeholder
  })
})
