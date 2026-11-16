/**
 * Minimal line diff for `agenthood update --dry-run` (#592).
 *
 * Longest-common-subsequence over lines, capped: a SKILL.md is a few hundred
 * lines, and the guard keeps a pathological file from allocating a huge table.
 */

export interface DiffLine {
  kind: ' ' | '-' | '+'
  text: string
}

const MAX_CELLS = 1_000_000

export function diffLines(local: string, upstream: string): DiffLine[] {
  const a = local.split('\n')
  const b = upstream.split('\n')
  if (a.length * b.length > MAX_CELLS) {
    return [
      ...a.map((text) => ({ kind: '-' as const, text })),
      ...b.map((text) => ({ kind: '+' as const, text })),
    ]
  }

  const dp: number[][] = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0))
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1])
    }
  }

  const out: DiffLine[] = []
  let i = 0
  let j = 0
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      out.push({ kind: ' ', text: a[i] })
      i++
      j++
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      out.push({ kind: '-', text: a[i++] })
    } else {
      out.push({ kind: '+', text: b[j++] })
    }
  }
  while (i < a.length) out.push({ kind: '-', text: a[i++] })
  while (j < b.length) out.push({ kind: '+', text: b[j++] })
  return out
}
