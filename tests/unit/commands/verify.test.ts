import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>()
  return {
    ...actual,
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
    readdirSync: vi.fn(),
    writeFileSync: vi.fn(),
  }
})

import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { verify } from '../../../src/commands/verify.ts'
import { contentHash } from '../../../src/utils/hash.ts'

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

describe('verify command', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.mocked(existsSync).mockReturnValue(true)
    vi.mocked(readdirSync).mockReturnValue([{ name: 'the-test', isDirectory: () => true }] as any)
    vi.mocked(writeFileSync).mockReturnValue(undefined)
  })

  it('passes valid SKILL.md files', async () => {
    vi.mocked(readFileSync).mockReturnValue(VALID_SKILL)
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
    vi.mocked(readFileSync).mockReturnValue('# No Frontmatter')
    const exit = vi.spyOn(process, 'exit').mockImplementation((() => {}) as any)

    await verify([])
    expect(exit).toHaveBeenCalledWith(1)
  })

  it('fails when required sections are missing', async () => {
    const content = '---\nname: test\ndescription: test\nlicense: MIT\n---\n\n## Only Overview\n'
    vi.mocked(readFileSync).mockReturnValue(content)
    const exit = vi.spyOn(process, 'exit').mockImplementation((() => {}) as any)

    await verify([])
    expect(exit).toHaveBeenCalledWith(1)
  })

  it('fails when placeholder content is present', async () => {
    const content = VALID_SKILL.replace('Test verification.', 'TODO: write this later')
    vi.mocked(readFileSync).mockReturnValue(content)
    const exit = vi.spyOn(process, 'exit').mockImplementation((() => {}) as any)

    await verify([])
    expect(exit).toHaveBeenCalledWith(1)
  })

  it('accepts --update-lock flag and writes lockfile', async () => {
    vi.mocked(readFileSync).mockReturnValue(VALID_SKILL)

    await verify(['--update-lock'])
    expect(writeFileSync).toHaveBeenCalled()
  })

  it('detects drift when lockfile hash does not match', async () => {
    const currentHash = contentHash(VALID_SKILL)
    const lockfileJson = JSON.stringify({ version: 1, members: { 'the-test': { version: 'different-hash', updatedAt: '2026-01-01T00:00:00.000Z' } } })
    vi.mocked(readFileSync)
      .mockReturnValueOnce(lockfileJson)
      .mockReturnValueOnce(VALID_SKILL)
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
    const OLD = '2026-01-01T00:00:00.000Z'
    const lockJson = JSON.stringify({
      version: 1,
      members: {
        'the-test': { version: h, updatedAt: OLD },
        'the-other': { version: 'stale', updatedAt: OLD },
      },
    })
    vi.mocked(readdirSync).mockReturnValue([
      { name: 'the-test', isDirectory: () => true },
      { name: 'the-other', isDirectory: () => true },
    ] as any)
    vi.mocked(readFileSync).mockImplementation(((p: string) =>
      String(p).endsWith('agenthood.lock') ? lockJson : VALID_SKILL.replace('the-test', String(p).split(/[\\/]/).at(-2))
    ) as any)
    const exit = vi.spyOn(process, 'exit').mockImplementation((() => {}) as any)

    await verify(['--update-lock'])

    expect(exit).not.toHaveBeenCalledWith(1)
    const written = JSON.parse(vi.mocked(writeFileSync).mock.calls.at(-1)![1] as string)
    // the drifted member is re-locked to a fresh hash; the unchanged one keeps its timestamp
    expect(written.members['the-other'].version).not.toBe('stale')
    expect(written.members['the-other'].updatedAt).not.toBe(OLD)
    expect(written.members['the-test'].version).toBe(h)
    expect(written.members['the-test'].updatedAt).toBe(OLD)
    // both members survive (no clobber) and keys are sorted for stable diffs
    expect(Object.keys(written.members)).toEqual(['the-other', 'the-test'])
  })

  it('fails when the skill violates the agentskills.io name spec', async () => {
    const badSkill = VALID_SKILL.replace('name: the-test', 'name: Bad_Name')
    vi.mocked(readFileSync).mockReturnValue(badSkill)
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    const exit = vi.spyOn(process, 'exit').mockImplementation((() => {}) as any)

    await verify([])

    expect(exit).toHaveBeenCalledWith(1)
    expect(log.mock.calls.flat().join(' ')).toContain('name-format')
  })
})
