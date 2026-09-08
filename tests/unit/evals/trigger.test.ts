import { describe, it, expect } from 'vitest'
import {
  scoreTriggers,
  splitTriggers,
  keywordPredictor,
  semanticPredictor,
  triggerRecommendations,
  validateTriggerQuerySet,
} from '../../../src/evals/trigger.ts'
import type { TriggerQuerySet, Predictor } from '../../../src/evals/trigger.ts'
import { SchemaValidationError } from '../../../src/core/SchemaValidator.ts'

const set: TriggerQuerySet = {
  member: 'the-scribe',
  shouldTrigger: ['write a commit message', 'draft the changelog'],
  shouldNotTrigger: ['refactor this function', 'find the security bug'],
}

const fixed = (selected: string | null): Predictor => () => selected

describe('scoreTriggers', () => {
  it('classifies tp/fn/fp/tn and derives metrics', async () => {
    const m = await scoreTriggers(set, fixed('the-scribe'))
    expect(m).toMatchObject({ truePositive: 2, falseNegative: 0, falsePositive: 2, trueNegative: 0 })
    expect(m.precision).toBe(0.5)
    expect(m.recall).toBe(1)
    expect(m.accuracy).toBe(0.5)
  })

  it('scores a perfect predictor at 1 across the board', async () => {
    const predict: Predictor = (q) => (set.shouldTrigger.includes(q) ? 'the-scribe' : null)
    const m = await scoreTriggers(set, predict)
    expect(m).toMatchObject({ truePositive: 2, falseNegative: 0, falsePositive: 0, trueNegative: 2 })
    expect(m.precision).toBe(1)
    expect(m.recall).toBe(1)
    expect(m.accuracy).toBe(1)
    expect(m.f1).toBe(1)
  })

  it('handles an empty set without divide-by-zero', async () => {
    const m = await scoreTriggers({ member: 'x', shouldTrigger: [], shouldNotTrigger: [] }, fixed(null))
    expect(m).toMatchObject({ precision: 0, recall: 0, accuracy: 0, f1: 0, truePositive: 0 })
  })
})

describe('splitTriggers', () => {
  it('partitions each bucket train-first and is deterministic', () => {
    const { train, validation } = splitTriggers(set, 0.5)
    expect(train.member).toBe('the-scribe')
    expect(validation.member).toBe('the-scribe')
    const allT = train.shouldTrigger.concat(validation.shouldTrigger).sort()
    expect(allT).toEqual([...set.shouldTrigger].sort())
    // deterministic across calls
    expect(splitTriggers(set, 0.5).train.shouldTrigger).toEqual(train.shouldTrigger)
  })

  it('keeps every query in exactly one side', () => {
    const { train, validation } = splitTriggers(set, 0.6)
    const sn = train.shouldNotTrigger.concat(validation.shouldNotTrigger).sort()
    expect(sn).toEqual([...set.shouldNotTrigger].sort())
  })
})

describe('keywordPredictor (MemberOrchestrator surface)', () => {
  it('selects the scribe for commit/changelog language', () => {
    expect(keywordPredictor()('write a commit message for this')).toBe('the-scribe')
  })

  it('does not select the scribe for unrelated work', () => {
    const p = keywordPredictor()
    expect(p('investigate this segmentation fault and debug the crash')).not.toBe('the-scribe')
  })
})

describe('semanticPredictor (embeddings surface)', () => {
  const descriptions = [
    { name: 'the-scribe', description: 'commit messages changelog' },
    { name: 'the-debugger', description: 'debug errors crashes' },
  ]
  // deterministic fake embedder keyed by substring of the description/query
  const embed = async (text: string) => {
    if (text.includes('commit')) return [1, 0]
    if (text.includes('debug')) return [0, 1]
    return [0, 0]
  }

  it('picks the most similar member description', async () => {
    const p = semanticPredictor(descriptions, embed)
    expect(await p('write commit stuff')).toBe('the-scribe')
    expect(await p('debug the crash')).toBe('the-debugger')
  })

  it('returns null below the min score', async () => {
    const p = semanticPredictor(descriptions, embed, 0.9)
    expect(await p('totally unrelated')).toBe(null)
  })
})

describe('triggerRecommendations', () => {
  it('flags missed activations when recall is low', () => {
    const recs = triggerRecommendations({
      truePositive: 1, falsePositive: 0, falseNegative: 4, trueNegative: 5,
      precision: 1, recall: 0.2, accuracy: 0.85, f1: 0.33,
    })
    expect(recs.join(' ').toLowerCase()).toContain('under-trigger')
  })

  it('flags over-triggering when precision is low', () => {
    const recs = triggerRecommendations({
      truePositive: 1, falsePositive: 4, falseNegative: 0, trueNegative: 5,
      precision: 0.2, recall: 1, accuracy: 0.85, f1: 0.33,
    })
    expect(recs.join(' ').toLowerCase()).toContain('over-trigger')
  })
})

describe('validateTriggerQuerySet', () => {
  it('accepts a well-formed set', () => {
    expect(() => validateTriggerQuerySet(set)).not.toThrow()
  })

  it('rejects a missing shouldNotTrigger array', () => {
    expect(() => validateTriggerQuerySet({ member: 'x', shouldTrigger: ['a'] })).toThrow(SchemaValidationError)
  })
})
