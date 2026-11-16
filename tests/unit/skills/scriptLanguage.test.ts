import { describe, it, expect } from 'vitest'
import { detectScript, hasNpmImport, hasPep723Block } from '../../../src/skills/execution/language.ts'

const LINUX = 'linux' as NodeJS.Platform

describe('script runtime detection (#546)', () => {
  it('runs a python script with uv when it carries a PEP 723 block (#539)', () => {
    const source = '#!/usr/bin/env python3\n# /// script\n# dependencies = ["requests"]\n# ///\nprint(1)'
    expect(hasPep723Block(source)).toBe(true)
    expect(detectScript('scripts/fetch.py', source, LINUX)?.command).toEqual(['uv', 'run'])
  })

  it('falls back to python3 without the block', () => {
    expect(detectScript('scripts/fetch.py', 'print(1)', LINUX)?.command).toEqual(['python3'])
  })

  it('uses python on Windows', () => {
    expect(detectScript('scripts/fetch.py', 'print(1)', 'win32')?.command).toEqual(['python'])
  })

  it('runs a TS script with deno when it imports npm: (#539)', () => {
    const source = "import { z } from 'npm:zod@3'"
    expect(hasNpmImport(source)).toBe(true)
    expect(detectScript('scripts/a.ts', source, LINUX)?.command).toEqual(['deno', 'run'])
  })

  it('runs plain JS and TS with node', () => {
    expect(detectScript('scripts/a.js', 'console.log(1)', LINUX)?.command).toEqual(['node'])
    expect(detectScript('scripts/a.ts', 'const a: number = 1', LINUX)?.command).toEqual(['node'])
  })

  it('runs a shell script with bash', () => {
    expect(detectScript('scripts/a.sh', 'echo hi', LINUX)?.command).toEqual(['bash'])
    expect(detectScript('scripts/a.bash', 'echo hi', LINUX)?.command).toEqual(['bash'])
  })

  it('uses a shebang when the extension says nothing', () => {
    expect(detectScript('bin/tool', '#!/usr/bin/env python3\nprint(1)', LINUX)?.language).toBe('python')
    expect(detectScript('bin/tool', '#!/bin/bash\necho hi', LINUX)?.language).toBe('bash')
  })

  it('returns undefined for an unsupported language rather than guessing', () => {
    expect(detectScript('scripts/a.rb', 'puts 1', LINUX)).toBeUndefined()
    expect(detectScript('scripts/a', 'plain text', LINUX)).toBeUndefined()
  })
})
