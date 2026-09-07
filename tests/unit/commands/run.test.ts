import { describe, it, expect } from 'vitest'
import { parseFlags } from '../../../src/commands/run.ts'

describe('run parseFlags', () => {
  it('keeps flags before -- and treats the rest as positional', () => {
    const out = parseFlags(['the-oracle', '--detect', '--', '--detect this looks like a flag'])
    expect(out.shouldDetect).toBe(true)
    expect(out.positional).toEqual(['the-oracle', '--detect this looks like a flag'])
  })

  it('treats a leading-dash task after -- as data, not a flag', () => {
    const out = parseFlags(['the-oracle', '--', '--provider', 'groq'])
    expect(out.providerOverride).toBeUndefined()
    expect(out.positional).toEqual(['the-oracle', '--provider', 'groq'])
  })

  it('parses --debug flag', () => {
    const out = parseFlags(['the-scribe', 'write a commit', '--debug'])
    expect(out.debug).toBe(true)
    expect(out.positional).toEqual(['the-scribe', 'write a commit'])
  })

  it('defaults debug to false', () => {
    const out = parseFlags(['the-scribe', 'write a commit'])
    expect(out.debug).toBe(false)
  })
})
