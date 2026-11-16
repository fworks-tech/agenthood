import { getCatalogModel } from '../llm/providers/opencodeCatalog.ts'

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
  // Ollama (local: free)
  { match: 'qwen2.5', price: { provider: 'ollama', inputPer1M: 0, outputPer1M: 0 } },
  { match: 'qwen2', price: { provider: 'ollama', inputPer1M: 0, outputPer1M: 0 } },
  { match: 'llama3', price: { provider: 'ollama', inputPer1M: 0, outputPer1M: 0 } },
  { match: 'phi3', price: { provider: 'ollama', inputPer1M: 0, outputPer1M: 0 } },
  { match: 'mistral', price: { provider: 'ollama', inputPer1M: 0, outputPer1M: 0 } },
]

/** Catalog rates belong to OpenCode; other providers keep their own table prices. */
function usesOpenCodeCatalog(provider?: string): boolean {
  return provider?.trim().toLowerCase().startsWith('opencode') ?? false
}

/** OpenCode Zen/Go prices come from the live catalog snapshot; `promptTokens` picks the context tier. */
export function getModelPrice(model: string, promptTokens = 0, provider?: string): ModelPrice {
  const normalized = model.trim().toLowerCase()
  if (!normalized) return FALLBACK_PRICE

  const catalog = usesOpenCodeCatalog(provider) ? getCatalogModel(normalized) : undefined
  if (catalog) {
    const tier = catalog.tiers.filter((t) => t.above < promptTokens).at(-1)
    return {
      provider: 'opencode',
      inputPer1M: tier?.input ?? catalog.input,
      outputPer1M: tier?.output ?? catalog.output,
    }
  }

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

/** Approximate token accounting: chars/4 heuristic for all models (v1). */
export function countTokens(text: string): number {
  if (!text) return 0
  return Math.max(1, Math.ceil(text.length / 4))
}

/** USD cost from token counts against the model pricing table. */
export function estimateCostFromTokens(
  model: string,
  inputTokens: number,
  outputTokens: number,
  provider?: string,
): number {
  const { inputPer1M, outputPer1M } = getModelPrice(model, inputTokens, provider)
  const cost = (inputTokens * inputPer1M + outputTokens * outputPer1M) / 1_000_000
  return roundCost(cost)
}

export interface CostEstimate {
  estimatedCost: number
  currency: 'USD'
  model: string
  inputTokens: number
  outputTokens: number
}

const warnedModels = new Set<string>()

/** Cost estimate with a one-time warning for models missing from the table. */
export function estimateCost(model: string, inputTokens: number, outputTokens: number, provider?: string): CostEstimate {
  const price = getModelPrice(model, inputTokens, provider)
  if (price === FALLBACK_PRICE && !warnedModels.has(model)) {
    console.warn(`[modelPricing] unknown model "${model}", using fallback pricing`)
    warnedModels.add(model)
  }
  return {
    estimatedCost: estimateCostFromTokens(model, inputTokens, outputTokens, provider),
    currency: 'USD',
    model,
    inputTokens,
    outputTokens,
  }
}
