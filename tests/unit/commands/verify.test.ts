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
import { verify } from '../../../src/commands/verify.js'

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
})
