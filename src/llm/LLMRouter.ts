/**
 * src/llm/LLMRouter.ts
 *
 * Routes LLM requests to the optimal provider chain. Supports per-member
 * provider preferences and complexity-based routing:
 *   low  → Groq (fast/cheap)
 *   medium → configured provider or Groq
 *   high → configured provider or Anthropic (capable)
 *
 * Provider modules are loaded lazily — the underlying SDK import happens
 * on first use, not when LLMRouter is imported.
 */

import type { ILLMProvider } from './ILLMProvider.js'
import type { LLMConfig, LLMRequest, ComplexityTier, ProviderEntry } from './types.js'
import type { ProviderName } from '../members/types.ts'
import { ProviderChain } from './ProviderFailover.js'

type ProviderFactory = (config: LLMConfig) => Promise<ILLMProvider>

/** Heuristic set of chain-of-thought triggers in system prompts.
 *  Extend as needed per deployment — non-English or alternative
 *  reasoning phrasing will not match without adding to this list. */
const COT_MARKERS = [
  'think step by step',
  'chain of thought',
  'let\'s reason',
  'let\'s work through',
  'step-by-step',
  'break down',
  'carefully analyze',
  'reason about',
  'consider the following',
  'first,',
  'second,',
]

/**
 * Heuristic complexity scorer for LLM requests.
 *
 * Evaluates message count, tool count, and chain‑of‑thought markers
 * to classify a request as low, medium, or high complexity.
 * Used by LLMRouter.route() when strategy is 'dynamic'.
 */
export class ComplexityScorer {
  /**
   * Score a request and return the complexity tier.
   *
   * Rules:
   * - high: >3 tools or system prompt contains chain‑of‑thought markers
   * - medium: >5 messages or any tools present
   * - low: else
   */
  score(request: LLMRequest): ComplexityTier {
    const messageCount = request.messages.length
    const toolCount = request.tools?.length ?? 0

    const systemMessages = request.messages.filter((m) => m.role === 'system')
    const systemContent = systemMessages.map((m) => m.content.toLowerCase()).join('\n')

    const hasThoughtMarkers = COT_MARKERS.some((marker) => systemContent.includes(marker))

    if (toolCount > 3 || hasThoughtMarkers) return 'high'

    if (messageCount > 5 || toolCount > 0) return 'medium'

    return 'low'
  }
}

/**
 * Static router that creates and caches LLM providers.
 *
 * Supports three modes:
 * - **create** — single provider or default provider chain
 * - **createForMember** — per‑member provider chain with preferred + fallback
 * - **route** — complexity‑based dynamic provider selection
 *
 * Provider modules are lazy‑loaded (dynamic import on first use),
 * so importing LLMRouter does not pull in provider SDKs.
 */
export class LLMRouter {
  private static providerFactories: Record<string, ProviderFactory> = {
    anthropic: async (c) => {
      const { AnthropicProvider } = await import('./providers/AnthropicProvider.js')
      return new AnthropicProvider(c)
    },
    groq: async (c) => {
      const { GroqProvider } = await import('./providers/GroqProvider.js')
      return new GroqProvider(c)
    },
    openai: async (c) => {
      const { OpenAIProvider } = await import('./providers/OpenAIProvider.js')
      return new OpenAIProvider(c)
    },
    ollama: async (c) => {
      const { OllamaProvider } = await import('./providers/OllamaProvider.js')
      return new OllamaProvider(c)
    },
    opencode: async (c) => {
      const { OpenCodeProvider } = await import('./providers/OpenCodeProvider.js')
      return new OpenCodeProvider(c)
    },
    'opencode-go': async (c) => {
      const { OpenCodeGoProvider } = await import('./providers/OpenCodeGoProvider.js')
      return new OpenCodeGoProvider(c)
    },
  }

  private static instances = new Map<string, ILLMProvider>()
  private static initPromises = new Map<string, Promise<ILLMProvider | null>>()
  private static config: LLMConfig = {}

  /**
   * Create a single provider or a default provider chain from config.
   * If config specifies a known provider, returns that provider.
   * Otherwise builds a ProviderChain with fallback order: groq → openai → ollama.
   */
  static async create(config: LLMConfig): Promise<ILLMProvider> {
    if (config.providers && config.providers.length > 0) {
      return LLMRouter.fromConfig(config)
    }

    LLMRouter.config = config

    if (config.provider && config.provider in LLMRouter.providerFactories) {
      const inst = await LLMRouter.getOrInit(config.provider)
      if (inst) return inst
    }

    return LLMRouter.buildDefaultChain(config)
  }

  static async fromConfig(config: LLMConfig): Promise<ILLMProvider> {
    const entries = config.providers ?? []
    if (entries.length === 0) return LLMRouter.create(config)

    const sorted = [...entries].sort((a, b) => (a.priority ?? 999) - (b.priority ?? 999))

    const instances: ILLMProvider[] = []
    const names: string[] = []
    const modelMap = new Map<string, string[]>()

    for (const entry of sorted) {
      const factory = LLMRouter.providerFactories[entry.name]
      if (!factory) continue
      try {
        const inst = await factory(LLMRouter.entryToConfig(entry, config))
        instances.push(inst)
        names.push(entry.name)
        if (entry.models && entry.models.length > 1) {
          modelMap.set(entry.name, entry.models)
        }
      } catch {
        // Provider init failed, skip
      }
    }

    if (instances.length === 0) return LLMRouter.create(config)

    return new ProviderChain(
      instances,
      names,
      {
        failureThreshold: config.failureThreshold,
        cooldownMs: config.cooldownMs,
        probeEnabled: config.probeEnabled,
      },
      modelMap.size > 0 ? modelMap : undefined,
    )
  }

  /**
   * Create a per‑member provider chain with the member's preferred provider first,
   * then fallback providers (groq, openai, ollama) in order.
   * Used when running individual Society members via `agenthood run <member>`.
   */
  static async createForMember(
    preferredProvider: ProviderName,
    config: LLMConfig,
  ): Promise<ILLMProvider> {
    LLMRouter.config = config

    const fallbackOrder: ProviderName[] = ['groq', 'openai', 'ollama']
    const providers = new Map<string, ILLMProvider>()

    for (const name of [preferredProvider, ...fallbackOrder]) {
      if (!providers.has(name) && name in LLMRouter.providerFactories) {
        const inst = await LLMRouter.getOrInit(name)
        if (inst) providers.set(name, inst)
      }
    }

    const providers_arr: ILLMProvider[] = []
    const names: string[] = []
    for (const name of [preferredProvider, ...fallbackOrder]) {
      const p = providers.get(name)
      if (p) {
        providers_arr.push(p)
        names.push(name)
      }
    }

    return new ProviderChain(
      providers_arr,
      names,
      {
        failureThreshold: config.failureThreshold,
        cooldownMs: config.cooldownMs,
        probeEnabled: config.probeEnabled,
      },
    )
  }

  private static entryToConfig(entry: ProviderEntry, base: LLMConfig): LLMConfig {
    return {
      ...base,
      provider: entry.name,
      model: entry.model ?? base.model,
      apiKey: entry.apiKey ?? base.apiKey,
      baseUrl: entry.baseUrl ?? base.baseUrl,
    }
  }

  /**
   * Route a request to a provider based on complexity score.
   *
   * When strategy is 'dynamic', uses ComplexityScorer to select:
   * - low → Groq (fast/cheap)
   * - medium → configured provider or Groq
   * - high → Anthropic (capable) or configured provider
   *
   * When strategy is 'static' (default), delegates to create().
   */
  static async route(request: LLMRequest, config: LLMConfig): Promise<ILLMProvider> {
    LLMRouter.config = config

    const strategy = config.routing?.strategy ?? 'static'

    if (strategy === 'static') {
      return LLMRouter.create(config)
    }

    const scorer = new ComplexityScorer()
    const tier = scorer.score(request)

    const configuredProvider = config.provider

    switch (tier) {
      case 'low':
        return (await LLMRouter.getOrInit('groq')) ?? await LLMRouter.buildDefaultChain(config)

      case 'medium':
        if (configuredProvider && configuredProvider in LLMRouter.providerFactories) {
          return (await LLMRouter.getOrInit(configuredProvider)) ?? await LLMRouter.buildDefaultChain(config)
        }
        return (await LLMRouter.getOrInit('groq')) ?? await LLMRouter.buildDefaultChain(config)

      case 'high':
        return (
          (await LLMRouter.getOrInit('anthropic')) ??
          (configuredProvider ? await LLMRouter.getOrInit(configuredProvider) : null) ??
          await LLMRouter.buildDefaultChain(config)
        )
    }
  }

  /**
   * Get a cached provider instance or initialise it on first access.
   * Deduplicates concurrent init requests so the same provider is
   * only constructed once even if multiple callers race.
   */
  private static async getOrInit(name: string): Promise<ILLMProvider | null> {
    if (LLMRouter.instances.has(name)) return LLMRouter.instances.get(name)!
    if (LLMRouter.initPromises.has(name)) return LLMRouter.initPromises.get(name)!

    const promise = (async () => {
      const factory = LLMRouter.providerFactories[name]
      if (!factory) return null
      try {
        const inst = await factory(LLMRouter.config)
        LLMRouter.instances.set(name, inst)
        return inst
      } catch {
        return null
      }
    })()

    LLMRouter.initPromises.set(name, promise)
    return promise
  }

  private static buildChainConfig(config: LLMConfig) {
    return {
      failureThreshold: config.failureThreshold,
      cooldownMs: config.cooldownMs,
      probeEnabled: config.probeEnabled,
    }
  }

  /**
   * Build the default ProviderChain with fallback order: groq → openai → ollama.
   * Used when config does not specify a single provider or when member
   * provider initialisation fails.
   */
  private static async buildDefaultChain(config?: LLMConfig): Promise<ILLMProvider> {
    const fallbackOrder: ProviderName[] = ['groq', 'openai', 'ollama']
    const providers = new Map<string, ILLMProvider>()

    for (const name of fallbackOrder) {
      if (!providers.has(name) && name in LLMRouter.providerFactories) {
        const inst = await LLMRouter.getOrInit(name)
        if (inst) providers.set(name, inst)
      }
    }

    const providers_arr: ILLMProvider[] = []
    const names: string[] = []
    for (const name of fallbackOrder) {
      const p = providers.get(name)
      if (p) {
        providers_arr.push(p)
        names.push(name)
      }
    }

    return new ProviderChain(providers_arr, names, LLMRouter.buildChainConfig(config ?? {}))
  }
}
