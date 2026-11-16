/**
 * src/llm/LLMRouter.ts
 *
 * Routes LLM requests to the optimal provider chain. Supports per-member
 * provider preferences and complexity-based routing:
 *   low  → Groq (fast/cheap)
 *   medium → configured provider or Groq
 *   high → configured provider or Anthropic (capable)
 *
 * Provider modules are loaded lazily: the underlying SDK import happens
 * on first use, not when LLMRouter is imported.
 */

import type { ILLMProvider } from './ILLMProvider.ts'
import type { IMultimodalProvider } from './IMultimodalProvider.ts'
import { isMultimodalProvider } from './IMultimodalProvider.ts'
import type { LLMConfig, LLMRequest, ComplexityTier, ProviderEntry } from './types.ts'
import { UnsupportedOperationError } from './errors.ts'
import type { ProviderName } from '../members/types.ts'
import { ProviderChain } from './ProviderFailover.ts'
import { RedactionFilter } from '../core/RedactionFilter.ts'
import { withRequestRedaction } from './withRequestRedaction.ts'

const PROVIDER_DEFAULT_PRIORITY = 999

// Always-on outbound redaction guard (built-in key/email/IP rules). Custom
// rules from observability config are applied to traces separately; this filter
// exists solely so secrets never leave the machine via a provider request.
const OUTBOUND_REDACTOR = new RedactionFilter()
function sortProvidersByPriority(a: ProviderEntry, b: ProviderEntry) {
  return (a.priority ?? PROVIDER_DEFAULT_PRIORITY) - (b.priority ?? PROVIDER_DEFAULT_PRIORITY)
}

type ProviderFactory = (config: LLMConfig) => Promise<ILLMProvider>

/** Heuristic set of chain-of-thought triggers in system prompts.
 *  Extend as needed per deployment: non-English or alternative
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
 * - **create**: single provider or default provider chain
 * - **createForMember**: per‑member provider chain with preferred + fallback
 * - **route**: complexity‑based dynamic provider selection
 *
 * Provider modules are lazy‑loaded (dynamic import on first use),
 * so importing LLMRouter does not pull in provider SDKs.
 */
export class LLMRouter {
  /** Single source of truth for --provider validation (see run.ts) */
  static knownProviders(): string[] {
    return Object.keys(LLMRouter.providerFactories)
  }

  private static providerFactories: Record<string, ProviderFactory> = {
    anthropic: async (c) => {
      const { AnthropicProvider } = await import( './providers/AnthropicProvider.ts')
      return new AnthropicProvider(c)
    },
    groq: async (c) => {
      const { GroqProvider } = await import( './providers/GroqProvider.ts')
      return new GroqProvider(c)
    },
    openai: async (c) => {
      const { OpenAIProvider } = await import( './providers/OpenAIProvider.ts')
      return new OpenAIProvider(c)
    },
    ollama: async (c) => {
      const { OllamaProvider } = await import( './providers/OllamaProvider.ts')
      return new OllamaProvider(c)
    },
    opencode: async (c) => {
      const { OpenCodeProvider } = await import( './providers/OpenCodeProvider.ts')
      return new OpenCodeProvider(c)
    },
    'opencode-go': async (c) => {
      const { OpenCodeGoProvider } = await import( './providers/OpenCodeGoProvider.ts')
      return new OpenCodeGoProvider(c)
    },
    openrouter: async (c) => {
      const { OpenRouterProvider } = await import( './providers/OpenRouterProvider.ts')
      return new OpenRouterProvider(c)
    },
    stub: async (c) => {
      const { StubProvider } = await import( './providers/StubProvider.ts')
      return new StubProvider(c)
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
      const inst = await LLMRouter.getOrInit(config.provider, config)
      if (inst) return inst
    }

    return LLMRouter.buildDefaultChain(config)
  }

  static async fromConfig(config: LLMConfig): Promise<ILLMProvider> {
    const entries = config.providers ?? []
    if (entries.length === 0) return LLMRouter.create(config)

    const sorted = [...entries].sort(sortProvidersByPriority)
    const { instances, names, modelMap } = await LLMRouter.buildChainFromEntries(sorted, config)

    if (instances.length === 0) return LLMRouter.create(config)

    return new ProviderChain(
      instances,
      names,
      LLMRouter.buildChainConfig(config),
      modelMap.size > 0 ? modelMap : undefined,
    )
  }

  /**
   * Instantiate providers for pre-ordered entries, skipping unknown names
   * and failed inits. Shared by fromConfig (priority order) and
   * createForMember (member-preference order): the only difference between
   * the two paths is the entry ordering, decided by the caller.
   */
  private static async buildChainFromEntries(
    entries: ProviderEntry[],
    config: LLMConfig,
  ): Promise<{ instances: ILLMProvider[]; names: string[]; modelMap: Map<string, string[]> }> {
    const instances: ILLMProvider[] = []
    const names: string[] = []
    const modelMap = new Map<string, string[]>()

    for (const entry of entries) {
      const factory = LLMRouter.providerFactories[entry.name]
      if (!factory) {
        console.debug(`[LLMRouter] no factory for provider "${entry.name}", skipping`)
        continue
      }
      try {
        const inst = await factory(LLMRouter.entryToConfig(entry, config))
        instances.push(withRequestRedaction(inst, OUTBOUND_REDACTOR))
        names.push(entry.name)
        if (entry.models && entry.models.length > 1) {
          modelMap.set(entry.name, entry.models)
        }
      } catch (err) {
        // Provider init failed, skip to fallback: surfaced at debug so a
        // misconfigured provider is visible without breaking offline runs
        console.debug(`[LLMRouter] provider "${entry.name}" init failed: ${err instanceof Error ? err.message : String(err)}`)
      }
    }

    return { instances, names, modelMap }
  }

  /**
   * Create a per‑member provider chain with the member's preferred provider first,
   * then fallback providers (groq, openai, ollama) in order.
   * Used when running individual Society members via `agenthood run <member>`.
   */
  static async createForMember(
    preferredProvider: ProviderName,
    config: LLMConfig,
    modelOverride?: string,
  ): Promise<ILLMProvider> {
    LLMRouter.config = config
    if (config.providers?.length) {
      // preference beats priority: member ask overrides operator order
      const sorted = [...config.providers].sort(sortProvidersByPriority)
      const prefEntry = sorted.find((e) => e.name === preferredProvider)
      const base: ProviderEntry = prefEntry ?? { name: preferredProvider }
      const preferred: ProviderEntry = modelOverride ? { ...base, model: modelOverride } : base
      const orderedEntries: ProviderEntry[] = [preferred, ...sorted.filter((e) => e.name !== preferredProvider)]
      const { instances, names, modelMap } = await LLMRouter.buildChainFromEntries(
        orderedEntries,
        config,
      )
      if (instances.length > 0) {
        return new ProviderChain(
          instances,
          names,
          LLMRouter.buildChainConfig(config),
          modelMap.size > 0 ? modelMap : undefined,
        )
      }
    }
    const order: ProviderName[] = [preferredProvider, 'groq', 'openai', 'ollama']
    const effective = modelOverride ? { ...config, model: modelOverride } : config
    return LLMRouter.buildProviderChain(order, effective)
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
  private static tierProviders: Record<ComplexityTier, (config: LLMConfig) => Promise<ILLMProvider>> = {
    low: (c) => LLMRouter.resolveSingle('groq', c),
    medium: (c) => {
      const preferred = c.provider && c.provider in LLMRouter.providerFactories ? c.provider : undefined
      return LLMRouter.resolveSingle(preferred ?? 'groq', c)
    },
    high: (c) => LLMRouter.resolveSingle('anthropic', c),
  }

  static async route(request: LLMRequest, config: LLMConfig): Promise<ILLMProvider> {
    LLMRouter.config = config

    // A non-text part needs a provider that can carry it (#124).
    if (request.parts?.some((part) => part.type !== 'text')) {
      return LLMRouter.multimodal(config)
    }

    const strategy = config.routing?.strategy ?? 'static'

    if (strategy === 'static') {
      return LLMRouter.create(config)
    }

    const scorer = new ComplexityScorer()
    const tier = scorer.score(request)

    const resolve = LLMRouter.tierProviders[tier]
    return resolve(config)
  }

  /**
   * A provider that implements the multimodal interface (#124). OpenAI is the
   * only implementation; everything else fails with the capability, not a
   * silent text-only answer to an image request.
   */
  static async multimodal(config: LLMConfig): Promise<IMultimodalProvider> {
    if ((config.provider ?? 'openai') !== 'openai') {
      throw new UnsupportedOperationError('multimodal generation', config.provider ?? 'unknown')
    }
    const { OpenAIMultimodalProvider } = await import('./providers/OpenAIMultimodalProvider.ts')
    const provider = new OpenAIMultimodalProvider(config)
    if (!isMultimodalProvider(provider)) {
      throw new UnsupportedOperationError('multimodal generation', 'openai')
    }
    return withRequestRedaction(provider, OUTBOUND_REDACTOR)
  }

  private static async resolveSingle(name: string, config: LLMConfig): Promise<ILLMProvider> {
    const preferred = config.provider && config.provider in LLMRouter.providerFactories ? config.provider : undefined
    return (
      (await LLMRouter.getOrInit(name, config)) ??
      (preferred ? await LLMRouter.getOrInit(preferred, config) : null) ??
      await LLMRouter.buildDefaultChain(config)
    )
  }

  /**
   * Get a cached provider instance or initialise it on first access.
   * Deduplicates concurrent init requests so the same provider is
   * only constructed once even if multiple callers race.
   *
   * Keyed by (provider, model): a provider object is bound to the model it was
   * constructed with, so a member-pinned model must not reuse the instance
   * that carries the shared config model.
   */
  private static async getOrInit(name: string, config: LLMConfig): Promise<ILLMProvider | null> {
    const key = LLMRouter.cacheKey(name, config)
    if (LLMRouter.instances.has(key)) return LLMRouter.instances.get(key)!
    if (LLMRouter.initPromises.has(key)) return LLMRouter.initPromises.get(key)!

    const promise = (async () => {
      const factory = LLMRouter.providerFactories[name]
      if (!factory) return null
      try {
        const inst = await factory(config)
        const wrapped = withRequestRedaction(inst, OUTBOUND_REDACTOR)
        LLMRouter.instances.set(key, wrapped)
        return wrapped
      } catch {
        return null
      }
    })()

    LLMRouter.initPromises.set(key, promise)
    return promise
  }

  private static cacheKey(name: string, config: LLMConfig): string {
    return `${name}::${config.model ?? ''}`
  }

  /** Drops every cached model variant of a provider: a rotated key invalidates all of them. */
  private static evict(name: string): void {
    const prefix = `${name}::`
    for (const key of [...LLMRouter.instances.keys(), ...LLMRouter.initPromises.keys()]) {
      if (!key.startsWith(prefix)) continue
      LLMRouter.instances.delete(key)
      LLMRouter.initPromises.delete(key)
    }
  }

  /**
   * Clear cached provider instance and reinitialize with new config.
   * Used for hot-reload after API key rotation.
   */
  /** Cached per-provider instance for single-provider use (health probes);
   *  unlike reinitializeProvider this reuses an existing instance. */
  static async getProvider(name: string, config: LLMConfig): Promise<ILLMProvider | null> {
    LLMRouter.config = config
    return LLMRouter.getOrInit(name, config)
  }

  static async reinitializeProvider(name: string, config: LLMConfig): Promise<ILLMProvider | null> {
    LLMRouter.evict(name)
    LLMRouter.config = config
    return LLMRouter.getOrInit(name, config)
  }

  private static buildChainConfig(config: LLMConfig) {
    return {
      failureThreshold: config.failureThreshold,
      cooldownMs: config.cooldownMs,
      probeEnabled: config.probeEnabled,
      requestTimeoutMs: config.requestTimeoutMs,
    }
  }

  /**
   * Build the default ProviderChain with fallback order: groq → openai → ollama.
   * Used when config does not specify a single provider or when member
   * provider initialisation fails.
   */
  private static async buildDefaultChain(config?: LLMConfig): Promise<ILLMProvider> {
    const fallbackOrder: ProviderName[] = ['groq', 'openai', 'ollama']
    return LLMRouter.buildProviderChain(fallbackOrder, config)
  }

  private static async buildProviderChain(
    order: ProviderName[],
    config: LLMConfig = {},
  ): Promise<ILLMProvider> {
    // Each factory cold-imports its SDK, so a serial loop makes chain-build
    // latency the SUM of every SDK load: enough to time out unit tests under
    // parallel CPU load (#465). Init concurrently; the assembly loop below
    // re-applies `order`, so failover behaviour is unchanged.
    const providers = new Map<string, ILLMProvider>()
    const initOrder = [...new Set(order)].filter((n) => n in LLMRouter.providerFactories)
    const inited = await Promise.all(initOrder.map((n) => LLMRouter.getOrInit(n, config ?? {})))
    initOrder.forEach((n, i) => {
      const inst = inited[i]
      if (inst) providers.set(n, inst)
    })

    const providersList: ILLMProvider[] = []
    const names: string[] = []
    for (const name of order) {
      const p = providers.get(name)
      if (p) {
        providersList.push(p)
        names.push(name)
      }
    }

    return new ProviderChain(providersList, names, LLMRouter.buildChainConfig(config ?? {}))
  }
}
