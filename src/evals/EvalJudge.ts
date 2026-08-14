import { cosineSimilarity } from '../utils/cosineSimilarity.js'
import type { ILLMProvider } from '../llm/ILLMProvider.js'

/**
 * Context a judge needs to score a single evaluation task. `expected` is the
 * suite's ground truth; `output` is what the member actually produced.
 */
export interface JudgeContext {
  input: string
  output: string
  expected: string
}

export interface EvalJudge {
  /** Returns a score in [0, 1], or null when the metric cannot be scored. */
  score(metric: string, context: JudgeContext): Promise<number | null>
}

const JUDGE_RUBRICS: Record<string, string> = {
  faithfulness:
    'Rate how faithful the answer is to the input: every claim in the answer must be supported by the input, with no invented details.',
  relevance: 'Rate how relevant the answer is to the input: it must directly address the task without drifting off-topic.',
  context_recall:
    'Rate how completely the answer covers the key facts of the expected output: how much of the ground truth the answer recalls.',
}

export const JUDGE_SYSTEM_PROMPT =
  'You are an evaluation judge. Score the answer on a single metric. Respond with ONLY one decimal number between 0 and 1, where 0 is worst and 1 is perfect. Do not explain.'

/**
 * Default judge. LLM-judged metrics (faithfulness, relevance, context_recall)
 * ask the provider for a bare score; answer_correctness compares embeddings
 * with cosine similarity so it costs no extra LLM calls.
 */
export class LLMJudge implements EvalJudge {
  constructor(private readonly llm: ILLMProvider) {}

  async score(metric: string, context: JudgeContext): Promise<number | null> {
    if (metric === 'answer_correctness') return this.embeddingScore(context)
    const rubric = JUDGE_RUBRICS[metric]
    if (!rubric) return null
    return this.llmScore(rubric, context)
  }

  private async llmScore(rubric: string, context: JudgeContext): Promise<number | null> {
    try {
      const response = await this.llm.complete({
        messages: [
          { role: 'system', content: JUDGE_SYSTEM_PROMPT },
          {
            role: 'user',
            content: [
              `Metric: ${rubric}`,
              `Input: ${context.input}`,
              `Expected output: ${context.expected}`,
              `Answer: ${context.output}`,
              'Score:',
            ].join('\n'),
          },
        ],
        temperature: 0,
        maxTokens: 16,
      })
      return parseJudgeScore(response.content)
    } catch {
      return null
    }
  }

  private async embeddingScore(context: JudgeContext): Promise<number | null> {
    try {
      const [answerEmbedding, expectedEmbedding] = await Promise.all([
        this.llm.embed(context.output),
        this.llm.embed(context.expected),
      ])
      return cosineSimilarity(answerEmbedding, expectedEmbedding)
    } catch {
      return null
    }
  }
}

/** Extracts the first number from a judge reply and clamps it to [0, 1]. */
export function parseJudgeScore(text: string): number | null {
  const match = text.match(/(\d+(?:\.\d+)?)/)
  if (!match) return null
  const n = Number(match[1])
  if (!Number.isFinite(n)) return null
  const normalized = n > 1 ? n / 100 : n
  return Math.max(0, Math.min(1, normalized))
}
