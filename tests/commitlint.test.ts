import { createRequire } from 'node:module'
import { describe, it, expect } from 'vitest'

const require = createRequire(import.meta.url)
const config = require('../conventions/commitlint.config.cjs')
const rule = config.plugins[0].rules['no-vague-subject'] as (ctx: { subject?: string }) => [boolean, string]

const BANNED = ['wip', 'fix stuff', 'update', 'changes', 'misc', 'asdf', 'temp', 'cleanup', 'test123']
const VALID  = ['add user login', 'fix null pointer in auth middleware', 'refactor token refresh logic']

describe('commitlint: no-vague-subject rule', () => {
  it.each(BANNED)('rejects banned subject "%s"', (subject) => {
    const [pass] = rule({ subject })
    expect(pass).toBe(false)
  })

  it.each(VALID)('accepts valid subject "%s"', (subject) => {
    const [pass] = rule({ subject })
    expect(pass).toBe(true)
  })

  it('rejects subject regardless of surrounding whitespace', () => {
    const [pass] = rule({ subject: '  wip  ' })
    expect(pass).toBe(false)
  })

  it('rejects subject case-insensitively', () => {
    const [pass] = rule({ subject: 'WIP' })
    expect(pass).toBe(false)
  })

  it('returns a non-empty error message on failure', () => {
    const [, message] = rule({ subject: 'wip' })
    expect(message.length).toBeGreaterThan(0)
  })

  it('accepts empty subject gracefully (other rules handle empty)', () => {
    const [pass] = rule({ subject: '' })
    expect(pass).toBe(true)
  })
})
