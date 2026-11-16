import { describe, it, expect } from 'vitest'
import { evaluateCondition, evaluateConditions, isKnownCondition, parseCondition } from '../../../src/skills/activation/conditions.ts'

describe('parseCondition (#610)', () => {
  it('splits on the first colon only', () => {
    expect(parseCondition('env:CI=true')).toEqual({ predicate: 'env', argument: 'CI=true' })
    expect(parseCondition('file.exists:src/a:b')).toEqual({ predicate: 'file.exists', argument: 'src/a:b' })
  })

  it('knows the four supported predicates', () => {
    expect(isKnownCondition('env:CI')).toBe(true)
    expect(isKnownCondition('file.exists:package.json')).toBe(true)
    expect(isKnownCondition('git.status:dirty')).toBe(true)
    expect(isKnownCondition('moon.phase:full')).toBe(false)
  })
})

describe('evaluateCondition (#610)', () => {
  it('checks whether an env var is set or equal to a value', () => {
    process.env.AGENTHOOD_CONDITION_TEST = 'yes'
    try {
      expect(evaluateCondition('env:AGENTHOOD_CONDITION_TEST', process.cwd()).ok).toBe(true)
      expect(evaluateCondition('env:AGENTHOOD_CONDITION_TEST=yes', process.cwd()).ok).toBe(true)
      expect(evaluateCondition('env:AGENTHOOD_CONDITION_TEST=no', process.cwd()).ok).toBe(false)
      expect(evaluateCondition('env:AGENTHOOD_CONDITION_MISSING', process.cwd()).ok).toBe(false)
    } finally {
      delete process.env.AGENTHOOD_CONDITION_TEST
    }
  })

  it('checks a file under the project root', () => {
    expect(evaluateCondition('file.exists:package.json', process.cwd()).ok).toBe(true)
    expect(evaluateCondition('file.exists:no-such-file', process.cwd()).ok).toBe(false)
  })

  it('refuses a path that escapes the project root', () => {
    const result = evaluateCondition('file.exists:../../etc/passwd', process.cwd())
    expect(result.ok).toBe(false)
    expect(result.ok === false && result.reason).toContain('escapes')
  })

  it('reports an unknown predicate instead of guessing', () => {
    expect(evaluateCondition('moon.phase:full', process.cwd()).ok).toBe(false)
  })

  it('treats an absent condition list as satisfied', () => {
    expect(evaluateConditions(undefined, process.cwd()).ok).toBe(true)
    expect(evaluateConditions([], process.cwd()).ok).toBe(true)
  })
})
