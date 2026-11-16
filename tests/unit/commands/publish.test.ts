import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { validateSkill } from '../../../src/commands/publish.ts'

const skill = (meta: string) => `---
name: lint
description: Lints things. Use when a file needs linting.
license: MIT
${meta}---
Body.
`

describe('publish namespaces (#593)', () => {
  let dir: string
  const write = (content: string) => {
    const path = join(dir, 'SKILL.md')
    writeFileSync(path, content)
    return path
  }

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'publish-'))
  })

  afterEach(() => rmSync(dir, { recursive: true, force: true }))

  it('publishes a skill that declares metadata.author', () => {
    const result = validateSkill(write(skill('metadata:\n  author: acme\n')))
    expect(result).toMatchObject({ ok: true, name: 'lint', owner: 'acme' })
  })

  it('falls back to --author for a monorepo skill without metadata.author', () => {
    expect(validateSkill(write(skill('')), 'fworks-tech')).toMatchObject({ ok: true, owner: 'fworks-tech' })
  })

  it('prefers the per-skill author over --author', () => {
    expect(validateSkill(write(skill('metadata:\n  author: acme\n')), 'fworks-tech')).toMatchObject({ owner: 'acme' })
  })

  it('refuses to publish without a namespace', () => {
    expect(validateSkill(write(skill('')))).toMatchObject({ ok: false })
  })

  it('refuses a malformed author', () => {
    expect(validateSkill(write(skill('metadata:\n  author: Acme_Inc\n')))).toMatchObject({ ok: false })
  })
})
