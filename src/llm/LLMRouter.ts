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
import type { LLMConfig, LLMRequest, ComplexityTier } from './types.js'
import type { ProviderName } from '../members/types.ts'
import { ProviderChain } from './ProviderFailover.js'

type ProviderFactory = (config: LLMConfig) => Promise<ILLMProvider>

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

export class ComplexityScorer {
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
  }

  private static instances = new Map<string, ILLMProvider>()
  private static initPromises = new Map<string, Promise<ILLMProvider | null>>()
  private static config: LLMConfig = {}

  static async create(config: LLMConfig): Promise<ILLMProvider> {
    LLMRouter.config = config

    if (config.provider && config.provider in LLMRouter.providerFactories) {
      const inst = await LLMRouter.getOrInit(config.provider)
      if (inst) return inst
    }

    return LLMRouter.buildDefaultChain()
  }

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

    return new ProviderChain(providers_arr, names)
  }

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
        return (await LLMRouter.getOrInit('groq')) ?? await LLMRouter.buildDefaultChain()

      case 'medium':
        if (configuredProvider && configuredProvider in LLMRouter.providerFactories) {
          return (await LLMRouter.getOrInit(configuredProvider)) ?? await LLMRouter.buildDefaultChain()
        }
        return (await LLMRouter.getOrInit('groq')) ?? await LLMRouter.buildDefaultChain()

      case 'high':
        return (
          (await LLMRouter.getOrInit('anthropic')) ??
          (configuredProvider ? await LLMRouter.getOrInit(configuredProvider) : null) ??
          await LLMRouter.buildDefaultChain()
        )
    }
  }

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

  private static async buildDefaultChain(): Promise<ILLMProvider> {
    const fallbackOrder: ProviderName[] = ['groq', 'openai', 'ollama']
    const providers = new Map<string, ILLMProvider>()

    for (const name of ['groq', ...fallbackOrder.filter((f) => f !== 'groq')]) {
      if (!providers.has(name) && name in LLMRouter.providerFactories) {
        const inst = await LLMRouter.getOrInit(name)
        if (inst) providers.set(name, inst)
      }
    }

    const providers_arr: ILLMProvider[] = []
    const names: string[] = []
    for (const name of ['groq', ...fallbackOrder.filter((f) => f !== 'groq')]) {
      const p = providers.get(name)
      if (p) {
        providers_arr.push(p)
        names.push(name)
      }
    }

    return new ProviderChain(providers_arr, names)
  }
}
