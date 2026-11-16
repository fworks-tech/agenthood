import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { escapesSkillDirectory, findMissingReferences } from '../../../src/skills/activation/references.ts'

let dir: string

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'skill-refs-'))
  mkdirSync(join(dir, 'references'), { recursive: true })
  mkdirSync(join(dir, 'scripts'), { recursive: true })
  writeFileSync(join(dir, 'references', 'guide.md'), '# guide')
  writeFileSync(join(dir, 'scripts', 'run.py'), 'print(1)')
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

describe('relative references from the skill directory (#542)', () => {
  it('reports a missing markdown link target and accepts an existing one', () => {
    const body = '[guide](references/guide.md) and [gone](references/gone.md)'
    expect(findMissingReferences(body, dir)).toEqual(['references/gone.md'])
  })

  it('checks path-like inline code spans, with or without ./', () => {
    const body = 'Run `./scripts/run.py` then `scripts/missing.py`.'
    expect(findMissingReferences(body, dir)).toEqual(['scripts/missing.py'])
  })

  it('ignores external links, anchors and prose', () => {
    const body = '[docs](https://example.com/x) [top](#overview) use `--dry-run` and `name`'
    expect(findMissingReferences(body, dir)).toEqual([])
  })

  it('never reports a path outside the skill directory', () => {
    expect(findMissingReferences('[x](../../etc/passwd)', dir)).toEqual([])
    expect(escapesSkillDirectory('../../etc/passwd', dir)).toBe(true)
    expect(escapesSkillDirectory('references/guide.md', dir)).toBe(false)
  })
})
