import { estimateCostFromTokens, getModelPrice } from "./modelPricing.ts"

/**
 * Approximate token accounting. Counts via the chars/4 heuristic for all
 * models (v1); precise per-model counting can replace this later.
 */
export class TokenCounter {
  countTokens(text: string, _model?: string): number {
    if (!text) return 0
    return Math.max(1, Math.ceil(text.length / 4))
  }

  estimateCost(model: string, inputTokens: number, outputTokens: number): number {
    return estimateCostFromTokens(model, inputTokens, outputTokens)
  }

  getModelPrice(model: string) {
    return getModelPrice(model)
  }
}
