import type { EvalJudge, JudgeContext } from './EvalJudge.ts'
import type { ABTaskScore } from './types.ts'

export class BlindJudge {
  constructor(private readonly judge: EvalJudge) {}

  async compareTask(
    input: string,
    expectedOutput: string,
    outputA: string,
    outputB: string,
    metrics: string[],
  ): Promise<ABTaskScore> {
    const ctxA: JudgeContext = { input, output: outputA, expected: expectedOutput }
    const ctxB: JudgeContext = { input, output: outputB, expected: expectedOutput }

    const scoresA: Record<string, number> = {}
    const scoresB: Record<string, number> = {}
    const deltas: Record<string, number> = {}

    for (const metric of metrics) {
      const [scoreA, scoreB] = await Promise.all([
        this.judge.score(metric, ctxA),
        this.judge.score(metric, ctxB),
      ])
      if (scoreA !== null) scoresA[metric] = scoreA
      if (scoreB !== null) scoresB[metric] = scoreB
      if (scoreA !== null && scoreB !== null) {
        deltas[metric] = Math.round((scoreB - scoreA) * 10000) / 10000
      }
    }

    return { input, expectedOutput, outputA, outputB, scoresA, scoresB, deltas }
  }
}
