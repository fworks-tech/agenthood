import { FALLBACK_PRICE, estimateCostFromTokens, getModelPrice } from "./modelPricing.ts"

export interface CostEstimate {
  estimatedCost: number
  currency: 'USD'
  model: string
  inputTokens: number
  outputTokens: number
}

export class CostEstimator {
  private warnedModels = new Set<string>()

  computeCost(model: string, inputTokens: number, outputTokens: number): CostEstimate {
    const price = getModelPrice(model)
    if (price === FALLBACK_PRICE && !this.warnedModels.has(model)) {
      console.warn(`[CostEstimator] unknown model "${model}" — using fallback pricing`)
      this.warnedModels.add(model)
    }
    return {
      estimatedCost: estimateCostFromTokens(model, inputTokens, outputTokens),
      currency: 'USD',
      model,
      inputTokens,
      outputTokens,
    }
  }
}
