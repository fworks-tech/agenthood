import { describe, it, expect, vi } from 'vitest'
import { parseEvalArgs, parseReplayLimit } from '../../../src/commands/evalArgs.ts'

describe('parseEvalArgs', () => {
  it('parses value flags, boolean flags, and positionals', () => {
    const parsed = parseEvalArgs(['the-scribe', '--suite', 's.json', '--baseline', 'b.json', '--json', '--replay', '--limit', '7'])
    expect(parsed.member).toBe('the-scribe')
    expect(parsed.suitePath).toBe('s.json')
    expect(parsed.baselinePath).toBe('b.json')
    expect(parsed.shouldJson).toBe(true)
    expect(parsed.shouldReplay).toBe(true)
    expect(parsed.shouldUpdateBaseline).toBe(false)
    expect(parsed.replayLimit).toBe(7)
    expect(parsed.helpRequested).toBe(false)
  })

  it('keeps defaults when no flags are given', () => {
    const parsed = parseEvalArgs(['the-scribe'])
    expect(parsed.replayLimit).toBe(50)
    expect(parsed.shouldJson).toBe(false)
    expect(parsed.shouldReplay).toBe(false)
  })

  it('collects repeated --provider flags and defaults to none', () => {
    expect(parseEvalArgs(['the-scribe']).providers).toEqual([])
    const parsed = parseEvalArgs(['the-scribe', '--suite', 's.json', '--provider', 'groq', '--provider', 'openai'])
    expect(parsed.providers).toEqual(['groq', 'openai'])
  })

  it('sets helpRequested on --help and -h', () => {
    expect(parseEvalArgs(['--help']).helpRequested).toBe(true)
    expect(parseEvalArgs(['-h']).helpRequested).toBe(true)
  })

  it('rejects a zero or missing replay limit', () => {
    vi.spyOn(process, 'exit').mockImplementation((() => { throw new Error('process.exit') }) as never)
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => parseReplayLimit('0')).toThrow('process.exit')
    expect(() => parseReplayLimit('-3')).toThrow('process.exit')
    expect(() => parseReplayLimit(undefined)).toThrow('process.exit')
  })
})
