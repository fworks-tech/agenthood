import type { RawSpec } from './member-specs.ts'

export interface LaneOverlap {
  a: string
  b: string
  shared: string[]
}

const STOPWORDS = new Set([
  'and', 'the', 'for', 'with', 'from', 'into', 'their', 'when', 'what',
  'why', 'uses', 'user', 'task', 'member',
])

function decisionTokens(decisions: string[]): Set<string> {
  const out = new Set<string>()
  for (const decision of decisions) {
    for (const token of decision.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/)) {
      if (token.length >= 3 && !STOPWORDS.has(token)) out.add(token)
    }
  }
  return out
}

/** Pairwise lane-overlap detection over the lane map's Owned Decisions.
 * Two members overlap when their decision vocabularies share a token. */
export function findLaneOverlaps(specs: RawSpec[]): LaneOverlap[] {
  const tokenized = new Map<string, Set<string>>()
  for (const spec of specs) {
    tokenized.set(spec.name, decisionTokens(spec.ownedDecisions))
  }

  const names = specs.map((s) => s.name)
  const overlaps: LaneOverlap[] = []
  for (let i = 0; i < names.length; i++) {
    for (let j = i + 1; j < names.length; j++) {
      const shared = [...tokenized.get(names[i])!]
        .filter((token) => tokenized.get(names[j])!.has(token))
        .sort()
      if (shared.length > 0) {
        overlaps.push({ a: names[i], b: names[j], shared })
      }
    }
  }
  return overlaps
}
