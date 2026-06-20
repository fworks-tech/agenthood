/**
 * src/llm/LLMRouter.ts
 *
 * Routes LLM requests to the right provider chain. Supports per-member
 * provider preferences so the-scribe always hits Anthropic, the-doorman
 * hits Ollama, etc.
 *
 * Providers are lazy-initialised so missing API keys don't break the
 * runtime until that specific provider is needed.
 */

import type { ILLMProvider } from './ILLMProvider.js'
import type { LLMConfig } from './types.js'
import type { ProviderName } from '../members/types.ts'
import { GroqProvider } from './providers/GroqProvider.js'
import { OllamaProvider } from './providers/OllamaProvider.js'
import { OpenAIProvider } from './providers/OpenAIProvider.js'
import { AnthropicProvider } from './providers/AnthropicProvider.js'
import { ProviderChain } from './ProviderFailover.js'

type ProviderFactory = (config: LLMConfig) => ILLMProvider

export class LLMRouter {
  /** Shared provider instances keyed by name, lazy-initialised. */
  private static providerFactories: Record<string, ProviderFactory> = {
    anthropic: (c) => new AnthropicProvider(c),
    groq: (c) => new GroqProvider(c),
    openai: (c) => new OpenAIProvider(c),
    ollama: (c) => new OllamaProvider(c),
  }

  private static instances = new Map<string, ILLMProvider>()
  private static config: LLMConfig = {}

  static create(config: LLMConfig): ILLMProvider {
    LLMRouter.config = config

    // If a specific provider was requested, return it directly
    if (config.provider && config.provider in LLMRouter.providerFactories) {
      const inst = LLMRouter.getOrInit(config.provider)
      if (inst) return inst
    }

    // Default: return a ProviderChain with Groq as preferred
    return LLMRouter.buildDefaultChain()
  }

  /** Build a failover chain with a specific member's preferences. */
  static createForMember(
    preferredProvider: ProviderName,
    config: LLMConfig,
  ): ILLMProvider {
    LLMRouter.config = config

    const fallbackOrder: ProviderName[] = ['groq', 'openai', 'ollama']
    const providers = new Map<string, ILLMProvider>()

    for (const name of [preferredProvider, ...fallbackOrder]) {
      if (!providers.has(name) && name in LLMRouter.providerFactories) {
        const inst = LLMRouter.getOrInit(name)
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

  private static getOrInit(name: string): ILLMProvider | null {
    let inst = LLMRouter.instances.get(name)
    if (!inst) {
      const factory = LLMRouter.providerFactories[name]
      if (!factory) return null
      try {
        inst = factory(LLMRouter.config)
        LLMRouter.instances.set(name, inst)
      } catch {
        // Provider failed to initialise (e.g. missing API key).
        // The caller gets null and the provider is skipped.
        return null
      }
    }
    return inst
  }

  private static buildDefaultChain(): ILLMProvider {
    const fallbackOrder: ProviderName[] = ['groq', 'openai', 'ollama']
    const providers = new Map<string, ILLMProvider>()

    for (const name of ['groq', ...fallbackOrder.filter((f) => f !== 'groq')]) {
      if (!providers.has(name) && name in LLMRouter.providerFactories) {
        const inst = LLMRouter.getOrInit(name)
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
