import { describe, it, expect, vi, afterEach } from 'vitest'
import { parseStoreInspectArgs } from '../../../src/commands/args.ts'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('parseStoreInspectArgs', () => {
  it('parses shared observability flags with defaults', () => {
    const out = parseStoreInspectArgs(['--member', 'the-scribe', '--limit', '5', '--since', '1h', '--json'])
    expect(out.member).toBe('the-scribe')
    expect(out.limit).toBe(5)
    expect(out.since).toBeTruthy()
    expect(out.json).toBe(true)
    expect(out.help).toBe(false)
  })

  it('defaults limit to 20 when omitted', () => {
    expect(parseStoreInspectArgs([]).limit).toBe(20)
  })

  it('consumes a value flag unconditionally (matches legacy behavior)', () => {
    // --member consumes the next token even when it looks like a flag; the
    // original per-command loops did the same, so this is preserved exactly
    const out = parseStoreInspectArgs(['--member', '--json'])
    expect(out.member).toBe('--json')
    expect(out.json).toBe(false)
  })

  it('sets help for --help and -h', () => {
    expect(parseStoreInspectArgs(['--help']).help).toBe(true)
    expect(parseStoreInspectArgs(['-h']).help).toBe(true)
  })

  it('delegates unknown flags to onFlag and consumes their value on true', () => {
    const seen: Array<[string, string | undefined]> = []
    const out = parseStoreInspectArgs(['--level', 'warn', '--member', 'the-warden'], (flag, value) => {
      seen.push([flag, value])
      if (flag === '--level') return true
      return false
    })
    expect(seen).toEqual([['--level', 'warn']])
    expect(out.member).toBe('the-warden')
  })

  it('does not consume the next arg when onFlag returns false', () => {
    const out = parseStoreInspectArgs(['--custom', '--member', 'x'], () => false)
    expect(out.member).toBe('x')
  })

  it('exits with a clear error on an invalid --limit', () => {
    const exit = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never)
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})

    parseStoreInspectArgs(['--limit', 'nope'])

    expect(error).toHaveBeenCalledWith('Invalid --limit value — expected a non-negative integer')
    expect(exit).toHaveBeenCalledWith(1)
  })

  it('exits with a clear error on an invalid --since', () => {
    const exit = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never)
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})

    parseStoreInspectArgs(['--since', 'not-a-date'])

    expect(error).toHaveBeenCalled()
    expect(exit).toHaveBeenCalledWith(1)
  })
})