import type { ILLMProvider } from '../llm/ILLMProvider.ts'
import type { EmbedFn } from '../evals/ReplayEvaluator.ts'
import { semanticPredictor, scoreTriggers, splitTriggers } from '../evals/trigger.ts'
import type { TriggerMetrics, TriggerQuerySet } from '../evals/trigger.ts'
import { rawSpecs } from '../members/member-specs.ts'

export interface OptimizationOptions {
  maxIterations: number
  variantsPerIteration: number
  f1ImprovementThreshold: number
  validationRatio: number
}

export interface VariantResult {
  description: string
  f1: number
  precision: number
  recall: number
  valF1: number
}

export interface OptimizationResult {
  member: string
  originalDescription: string
  originalMetrics: TriggerMetrics
  bestDescription: string
  bestMetrics: TriggerMetrics
  iterations: number
  variants: VariantResult[]
  improved: boolean
}

const DEFAULT_OPTIONS: OptimizationOptions = {
  maxIterations: 3,
  variantsPerIteration: 3,
  f1ImprovementThreshold: 0.02,
  validationRatio: 0.4,
}

export class DescriptionOptimizer {
  constructor(
    private readonly llm: ILLMProvider,
    private readonly embed: EmbedFn,
    private readonly options: Partial<OptimizationOptions> = {},
  ) {}

  private get opts(): OptimizationOptions {
    return { ...DEFAULT_OPTIONS, ...this.options }
  }

  async optimize(member: string, triggerSet: TriggerQuerySet): Promise<OptimizationResult> {
    const spec = rawSpecs.find((s) => s.name === member)
    if (!spec) throw new Error(`Unknown member: "${member}"`)

    const originalDescription = spec.description
    const originalMetrics = await this.scoreDescription(member, originalDescription, triggerSet)

    const allVariants: VariantResult[] = []
    let bestDescription = originalDescription
    let bestMetrics = originalMetrics
    let iterations = 0

    for (let i = 0; i < this.opts.maxIterations; i++) {
      iterations++
      const variants = await this.generateVariants(member, bestDescription, triggerSet)
      const scored = await Promise.all(
        variants.map(async (desc) => {
          const metrics = await this.scoreDescription(member, desc, triggerSet)
          const valMetrics = await this.scoreValidation(member, desc, triggerSet)
          return {
            description: desc,
            f1: metrics.f1,
            precision: metrics.precision,
            recall: metrics.recall,
            valF1: valMetrics.f1,
          }
        }),
      )

      allVariants.push(...scored)

      const bestVariant = scored.reduce((a, b) => (b.valF1 > a.valF1 ? b : a))
      const improvement = bestVariant.valF1 - bestMetrics.f1

      if (improvement > this.opts.f1ImprovementThreshold) {
        bestDescription = bestVariant.description
        bestMetrics = await this.scoreDescription(member, bestDescription, triggerSet)
      } else {
        break
      }
    }

    return {
      member,
      originalDescription,
      originalMetrics,
      bestDescription,
      bestMetrics,
      iterations,
      variants: allVariants,
      improved: bestMetrics.f1 > originalMetrics.f1,
    }
  }

  private async scoreDescription(
    member: string,
    description: string,
    triggerSet: TriggerQuerySet,
  ): Promise<TriggerMetrics> {
    const descriptions = rawSpecs.map((s) => ({
      name: s.name,
      description: s.name === member ? description : s.description,
    }))
    const predict = semanticPredictor(descriptions, this.embed)
    return scoreTriggers(triggerSet, predict)
  }

  private async scoreValidation(
    member: string,
    description: string,
    triggerSet: TriggerQuerySet,
  ): Promise<TriggerMetrics> {
    const split = splitTriggers(triggerSet, 1 - this.opts.validationRatio)
    const descriptions = rawSpecs.map((s) => ({
      name: s.name,
      description: s.name === member ? description : s.description,
    }))
    const predict = semanticPredictor(descriptions, this.embed)
    return scoreTriggers(split.validation, predict)
  }

  private async generateVariants(
    member: string,
    currentDescription: string,
    triggerSet: TriggerQuerySet,
  ): Promise<string[]> {
    const prompt = this.buildPrompt(member, currentDescription, triggerSet)
    const response = await this.llm.complete({
      messages: [
        { role: 'system', content: OPTIMIZE_SYSTEM_PROMPT },
        { role: 'user', content: prompt },
      ],
    })

    return parseVariants(response.content)
  }

  private buildPrompt(
    member: string,
    currentDescription: string,
    triggerSet: TriggerQuerySet,
  ): string {
    return `Member: ${member}
Current description: "${currentDescription}"

Should-trigger queries (description should activate for these):
${triggerSet.shouldTrigger.map((q) => `  - ${q}`).join('\n')}

Should-not-trigger queries (description should NOT activate for these):
${triggerSet.shouldNotTrigger.map((q) => `  - ${q}`).join('\n')}

Generate ${this.opts.variantsPerIteration} improved description variants. Each variant must be a single line, under 150 characters, describing what the member does. Focus on maximizing activation for should-trigger queries while avoiding activation for should-not-trigger queries.`
  }
}

const OPTIMIZE_SYSTEM_PROMPT =
  'You are a skill description optimizer. Generate description variants that maximize trigger accuracy. Respond with one description per line, no numbering, no quotes, no explanation.'

function parseVariants(content: string): string[] {
  return content
    .split('\n')
    .map((line) => line.replace(/^\d+\.\s*/, '').replace(/^["']|["']$/g, '').trim())
    .filter((line) => line.length > 0 && line.length <= 200)
}
