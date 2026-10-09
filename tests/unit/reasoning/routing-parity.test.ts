import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { ROUTING_INTENTS } from '../../../src/reasoning/routing.ts'

// The confidence cascade was introduced with two model lists for the same
// three tiers, and GPT-4o in two of them. Both are drift between two documents
// that state the same rule, so the rule is asserted once, here.
const AGENTS = readFileSync(join(process.cwd(), 'AGENTS.md'), 'utf8')
const MEDIATOR = readFileSync(join(process.cwd(), 'skills', 'mediator', 'SKILL.md'), 'utf8')
const STEWARD = readFileSync(join(process.cwd(), 'skills', 'steward', 'SKILL.md'), 'utf8')

function agentsTiers(): Record<string, string[]> {
  const tiers: Record<string, string[]> = {}
  for (const [, pct, models] of AGENTS.matchAll(/-\s*(\d+-\d+)%:\s*\w+ tier \(([^)]*)\)/g)) {
    tiers[pct] = models.split(',').map((m) => m.trim()).sort()
  }
  return tiers
}

function stewardTiers(): Record<string, string[]> {
  const tiers: Record<string, string[]> = {}
  for (const [, pct, models] of STEWARD.matchAll(/^\|\s*(\d+-\d+)%\s*\|[^|]*\|([^|]*)\|/gm)) {
    tiers[pct] = models.split(',').map((m) => m.trim()).sort()
  }
  return tiers
}

describe('confidence-gated routing parity', () => {
  it('AGENTS.md and steward name the same models for each tier', () => {
    const expected = { '0-39': ['Flash', 'Haiku', 'mini'], '40-69': ['GPT-4o', 'Gemini Pro', 'Sonnet'], '70-100': ['Gemini 2.0', 'Opus', 'o1'] }
    expect(agentsTiers()).toEqual(expected)
    expect(stewardTiers()).toEqual(expected)
  })

  it('puts no model in two tiers', () => {
    const tiers = Object.values(stewardTiers())
    const seen = new Map<string, string>()
    for (const [pct, models] of Object.entries(stewardTiers())) {
      for (const m of models) {
        expect(seen.get(m), `${m} appears in both ${seen.get(m)} and ${pct}`).toBeUndefined()
        seen.set(m, pct)
      }
    }
    expect(tiers.length).toBe(3)
  })

  it('uses the same three cascade thresholds in both documents', () => {
    for (const doc of [AGENTS, STEWARD]) {
      expect(doc).toContain('90%')
      expect(doc).toContain('80%')
    }
    expect(AGENTS).toContain('If complexity confidence < 80%')
    expect(STEWARD).toContain('if complexity confidence is below 80%')
  })

  it('never names a retired model in a tier', () => {
    const all = [...Object.values(stewardTiers()), ...Object.values(agentsTiers())].flat()
    for (const retired of ['Gemini 1.5', 'GPT-3.5', 'Claude 2', 'o1-mini']) {
      expect(all, `${retired} is retired but still routed to`).not.toContain(retired)
    }
  })
})

describe('routing record documented in the member files', () => {
  it('mediator points at the directory the validator reads', () => {
    expect(MEDIATOR).toContain('.agenthood/routing/')
    expect(MEDIATOR).not.toContain('"intent": "clear-implementation"')
  })

  it('every intent slug the mediator documents is a real bucket', () => {
    for (const intent of ROUTING_INTENTS) {
      expect(MEDIATOR, `${intent} missing from mediator/SKILL.md`).toContain(intent)
    }
  })

  it('the example record carries every field the validator requires', () => {
    // Handle both LF and CRLF line endings
    const json = /```json\r?\n([\s\S]*?)```/.exec(MEDIATOR)?.[1]
    expect(json, 'mediator/SKILL.md has no json example').toBeDefined()
    const example = JSON.parse(json!)
    for (const field of ['id', 'timestamp', 'member', 'intent', 'confidence', 'confidence_factors', 'target', 'reasoning', 'alternatives_considered', 'cascade_applied', 'parallel_evaluation']) {
      expect(example, `example record is missing ${field}`).toHaveProperty(field)
    }
  })

it('the example record is one the validator would accept', async () => {
    const { validateRoutingDecision } = await import('../../../src/reasoning/routing.ts')
    const { MEMBER_NAMES } = await import('../../../src/members.ts')
    const json = /```json\r?\n([\s\S]*?)```/.exec(MEDIATOR)?.[1]
    expect(json, 'mediator/SKILL.md has no json example').toBeDefined()
    expect(validateRoutingDecision(JSON.parse(json!), MEMBER_NAMES)).toEqual([])
  })
})
