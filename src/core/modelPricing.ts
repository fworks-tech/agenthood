export type PricingProvider = 'openai' | 'anthropic' | 'groq' | 'ollama' | 'opencode' | 'other'

export interface ModelPrice {
  provider: PricingProvider
  /** USD per 1M input tokens */
  inputPer1M: number
  /** USD per 1M output tokens */
  outputPer1M: number
}

export const FALLBACK_PRICE: ModelPrice = {
  provider: 'other',
  inputPer1M: 1.0,
  outputPer1M: 3.0,
}

const PRICING_TABLE: Array<{ match: string; price: ModelPrice }> = [
  // OpenAI
  { match: 'gpt-4o-mini', price: { provider: 'openai', inputPer1M: 0.15, outputPer1M: 0.6 } },
  { match: 'gpt-4o', price: { provider: 'openai', inputPer1M: 2.5, outputPer1M: 10 } },
  { match: 'gpt-4-turbo', price: { provider: 'openai', inputPer1M: 10, outputPer1M: 30 } },
  { match: 'gpt-4', price: { provider: 'openai', inputPer1M: 30, outputPer1M: 60 } },
  { match: 'gpt-3.5-turbo', price: { provider: 'openai', inputPer1M: 0.5, outputPer1M: 1.5 } },
  // Anthropic
  { match: 'claude-3-5-haiku', price: { provider: 'anthropic', inputPer1M: 0.8, outputPer1M: 4 } },
  { match: 'claude-3-5-sonnet', price: { provider: 'anthropic', inputPer1M: 3, outputPer1M: 15 } },
  { match: 'claude-3-haiku', price: { provider: 'anthropic', inputPer1M: 0.25, outputPer1M: 1.25 } },
  { match: 'claude-3-opus', price: { provider: 'anthropic', inputPer1M: 15, outputPer1M: 75 } },
  { match: 'claude-sonnet', price: { provider: 'anthropic', inputPer1M: 3, outputPer1M: 15 } },
  { match: 'claude-opus', price: { provider: 'anthropic', inputPer1M: 15, outputPer1M: 75 } },
  { match: 'claude-haiku', price: { provider: 'anthropic', inputPer1M: 0.8, outputPer1M: 4 } },
  // Groq
  { match: 'llama-3.3-70b', price: { provider: 'groq', inputPer1M: 0.59, outputPer1M: 0.79 } },
  { match: 'llama-3.1-8b', price: { provider: 'groq', inputPer1M: 0.05, outputPer1M: 0.08 } },
  { match: 'llama-3.1-70b', price: { provider: 'groq', inputPer1M: 0.59, outputPer1M: 0.79 } },
  { match: 'mixtral-8x7b', price: { provider: 'groq', inputPer1M: 0.24, outputPer1M: 0.24 } },
  { match: 'gemma2-9b', price: { provider: 'groq', inputPer1M: 0.2, outputPer1M: 0.2 } },
  { match: 'gemma2-27b', price: { provider: 'groq', inputPer1M: 0.27, outputPer1M: 0.27 } },
  // Ollama (local — free)
  { match: 'qwen2.5', price: { provider: 'ollama', inputPer1M: 0, outputPer1M: 0 } },
  { match: 'qwen2', price: { provider: 'ollama', inputPer1M: 0, outputPer1M: 0 } },
  { match: 'llama3', price: { provider: 'ollama', inputPer1M: 0, outputPer1M: 0 } },
  { match: 'phi3', price: { provider: 'ollama', inputPer1M: 0, outputPer1M: 0 } },
  { match: 'mistral', price: { provider: 'ollama', inputPer1M: 0, outputPer1M: 0 } },
  // OpenCode Go / Zen (https://opencode.ai/docs/go/ — base tier pricing)
  { match: 'deepseek-v4-flash', price: { provider: 'opencode', inputPer1M: 0.14, outputPer1M: 0.28 } },
  { match: 'deepseek-v4-pro', price: { provider: 'opencode', inputPer1M: 0.435, outputPer1M: 0.87 } },
  { match: 'grok-4.5', price: { provider: 'opencode', inputPer1M: 2, outputPer1M: 6 } },
  { match: 'gpt-5.6-luna', price: { provider: 'opencode', inputPer1M: 0.2, outputPer1M: 1.2 } },
  { match: 'glm-5.2', price: { provider: 'opencode', inputPer1M: 1.4, outputPer1M: 4.4 } },
  { match: 'glm-5.1', price: { provider: 'opencode', inputPer1M: 1.4, outputPer1M: 4.4 } },
  { match: 'kimi-k3', price: { provider: 'opencode', inputPer1M: 3, outputPer1M: 15 } },
  { match: 'kimi-k2.7-code', price: { provider: 'opencode', inputPer1M: 0.95, outputPer1M: 4 } },
  { match: 'kimi-k2.6', price: { provider: 'opencode', inputPer1M: 0.95, outputPer1M: 4 } },
  { match: 'mimo-v2.5-pro', price: { provider: 'opencode', inputPer1M: 0.435, outputPer1M: 0.87 } },
  { match: 'mimo-v2.5', price: { provider: 'opencode', inputPer1M: 0.14, outputPer1M: 0.28 } },
  { match: 'minimax-m3', price: { provider: 'opencode', inputPer1M: 0.3, outputPer1M: 1.2 } },
  { match: 'minimax-m2.7', price: { provider: 'opencode', inputPer1M: 0.3, outputPer1M: 1.2 } },
  { match: 'minimax-m2.5', price: { provider: 'opencode', inputPer1M: 0.3, outputPer1M: 1.2 } },
  { match: 'qwen3.8-max', price: { provider: 'opencode', inputPer1M: 2, outputPer1M: 6 } },
  { match: 'qwen3.7-max', price: { provider: 'opencode', inputPer1M: 2.5, outputPer1M: 7.5 } },
  { match: 'qwen3.7-plus', price: { provider: 'opencode', inputPer1M: 0.4, outputPer1M: 1.6 } },
  { match: 'qwen3.6-plus', price: { provider: 'opencode', inputPer1M: 0.5, outputPer1M: 3 } },
  { match: 'hy3', price: { provider: 'opencode', inputPer1M: 0.14, outputPer1M: 0.58 } },
]

export function getModelPrice(model: string): ModelPrice {
  const normalized = model.trim().toLowerCase()
  if (!normalized) return FALLBACK_PRICE

  const exact = PRICING_TABLE.find(({ match }) => normalized === match)
  if (exact) return exact.price

  const prefix = PRICING_TABLE.filter(({ match }) => normalized.startsWith(match))
  if (prefix.length > 0) {
    prefix.sort((a, b) => b.match.length - a.match.length)
    return prefix[0].price
  }
  return FALLBACK_PRICE
}

export function roundCost(cost: number): number {
  return Math.round(cost * 10000) / 10000
}

/** USD cost from token counts against the model pricing table. */
export function estimateCostFromTokens(
  model: string,
  inputTokens: number,
  outputTokens: number,
): number {
  const { inputPer1M, outputPer1M } = getModelPrice(model)
  const cost = (inputTokens * inputPer1M + outputTokens * outputPer1M) / 1_000_000
  return roundCost(cost)
}
