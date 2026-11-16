import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { pickVariantKey, selectVariantBody } from '../../../src/skills/discovery/variants.ts'
import type { ISkillManifest } from '../../../src/skills/discovery/ISkillManifest.ts'

let dir: string

const manifest = (variants: Record<string, string>, body = 'default body'): ISkillManifest => ({
  name: 'demo',
  description: 'demo',
  tier: 'community',
  location: join(dir, 'SKILL.md'),
  directory: dir,
  body,
  resources: [],
  variants,
})

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'skill-variants-'))
  mkdirSync(join(dir, 'references'), { recursive: true })
  writeFileSync(join(dir, 'references', 'opus.md'), 'opus instructions')
  writeFileSync(join(dir, 'references', 'haiku.md'), 'haiku instructions')
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

describe('variant selection (#551)', () => {
  it('takes the longest matching fragment', () => {
    expect(pickVariantKey({ opus: 'a.md', 'claude-opus-4': 'b.md' }, 'claude-opus-4-20250514')).toBe('claude-opus-4')
  })

  it('matches case-insensitively', () => {
    expect(pickVariantKey({ Haiku: 'a.md' }, 'claude-haiku-4')).toBe('Haiku')
  })

  it('returns the default body when no fragment matches', () => {
    expect(selectVariantBody(manifest({ opus: 'references/opus.md' }), 'gpt-4o').body).toBe('default body')
  })

  it('returns the default body when the model is unknown', () => {
    expect(selectVariantBody(manifest({ opus: 'references/opus.md' })).body).toBe('default body')
  })

  it('reads the matching variant file from inside the skill directory', () => {
    const selection = selectVariantBody(manifest({ haiku: 'references/haiku.md' }), 'claude-haiku-4')
    expect(selection.body).toBe('haiku instructions')
    expect(selection.variant).toBe('haiku')
    expect(selection.warning).toBeUndefined()
  })

  it('falls back with a warning when the variant file is missing', () => {
    const selection = selectVariantBody(manifest({ haiku: 'references/gone.md' }), 'claude-haiku-4')
    expect(selection.body).toBe('default body')
    expect(selection.warning).toContain('not found')
  })

  it('refuses a variant that escapes the skill directory', () => {
    const selection = selectVariantBody(manifest({ haiku: '../outside.md' }), 'claude-haiku-4')
    expect(selection.body).toBe('default body')
    expect(selection.warning).toContain('outside the skill directory')
  })

  it('falls back with a warning when the variant is empty', () => {
    writeFileSync(join(dir, 'references', 'empty.md'), '   \n')
    const selection = selectVariantBody(manifest({ haiku: 'references/empty.md' }), 'claude-haiku-4')
    expect(selection.body).toBe('default body')
    expect(selection.warning).toContain('empty')
  })
})
