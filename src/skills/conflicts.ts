export interface ConflictCandidate {
  name: string
  description: string
}

export interface SkillConflict {
  a: string
  b: string
  score: number
  shared: string[]
  resolution: string
}

const STOP_WORDS = new Set([
  'the', 'and', 'for', 'with', 'when', 'use', 'user', 'this', 'that', 'from',
  'into', 'than', 'then', 'are', 'was', 'were', 'has', 'have', 'had', 'not',
  'but', 'all', 'can', 'will', 'any', 'its', 'their', 'them', 'they', 'you',
  'your', 'our', 'out', 'who', 'what', 'how', 'why', 'which', 'using', 'used',
  'also', 'each', 'before', 'after', 'between', 'over', 'under', 'more', 'most',
  'skill', 'skills', 'agents', 'agent', 'code', 'coding', 'work', 'working', 'task', 'tasks',
  'ask', 'asks', 'asked', 'asking', 'triggers', 'trigger',
])

const MIN_TOKENS = 4
// ponytail: lexical token-overlap, not sentence embeddings — deterministic,
// offline, zero deps. If the FP rate climbs past the #595 budget (<10%),
// swap tokenize() for an embedding-based similarity behind the same signature.
export const OVERLAP_THRESHOLD = 0.8

export function tokenize(description: string): Set<string> {
  return new Set(
    description
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length >= 3 && !STOP_WORDS.has(w)),
  )
}

function resolutionFor(a: Set<string>, b: Set<string>): string {
  const [smaller, larger] = a.size <= b.size ? [a, b] : [b, a]
  const subset = [...smaller].every((t) => larger.has(t))
  if (subset) return 'one description is contained in the other — remove the narrower skill, or specialize it (narrow its "Use when" triggers to a distinct case)'
  return 'near-duplicate descriptions — remove one, or specialize both (split their "Use when" triggers so only one fires per task)'
}

export function findConflicts(skills: ConflictCandidate[], threshold = OVERLAP_THRESHOLD): SkillConflict[] {
  const tokenized = skills.map((s) => ({ name: s.name, tokens: tokenize(s.description) }))
  const conflicts: SkillConflict[] = []
  for (let i = 0; i < tokenized.length; i++) {
    for (let j = i + 1; j < tokenized.length; j++) {
      const A = tokenized[i].tokens
      const B = tokenized[j].tokens
      // Short descriptions lack the vocabulary for a meaningful overlap signal
      // and would turn two 3-word blurbs into a false positive.
      if (A.size < MIN_TOKENS || B.size < MIN_TOKENS) continue
      const shared = [...A].filter((t) => B.has(t))
      const score = shared.length / new Set([...A, ...B]).size
      if (score > threshold) {
        conflicts.push({
          a: tokenized[i].name,
          b: tokenized[j].name,
          score,
          shared: shared.sort(),
          resolution: resolutionFor(A, B),
        })
      }
    }
  }
  return conflicts.sort((x, y) => y.score - x.score)
}
