import type { ModalPart } from './IMultimodalProvider.ts'

export type MessageRole = 'system' | 'user' | 'assistant' | 'tool'

export interface Message {
  role: MessageRole
  content: string
  toolCalls?: ToolCall[]
  tool_call_id?: string
  name?: string
}

export interface ToolCall {
  id: string
  name: string
  args: unknown
}

export interface ToolSchema {
  name: string
  description: string
  inputSchema: JSONSchema
}

export interface JSONSchema {
  type: string
  properties?: Record<string, JSONSchemaProperty>
  required?: string[]
  [key: string]: unknown
}

export interface JSONSchemaProperty {
  type: string
  description?: string
  maxLength?: number
  /** Allowed values: `activate_skill` constrains the name to discovered skills (#531). */
  enum?: string[]
  /** Element schema for `type: 'array'` (ADR-036 script arguments). */
  items?: JSONSchemaProperty
}

export interface TokenUsage {
  promptTokens: number
  completionTokens: number
  totalTokens: number
  cacheCreationInputTokens?: number
  cacheReadInputTokens?: number
}

export interface LLMRequest {
  messages: Message[]
  /** Non-text content; a non-text part routes to a multimodal provider (#124). */
  parts?: ModalPart[]
  tools?: ToolSchema[]
  temperature?: number
  maxTokens?: number
  top_p?: number
  frequency_penalty?: number
  presence_penalty?: number
  stop?: string[]
  contextWindow?: number
}

export interface LLMResponse {
  content: string
  toolCalls?: ToolCall[]
  usage: TokenUsage
  model: string
  /** Provider that answered, so cost is priced against the right table. */
  provider?: string
}

export interface LLMChunk {
  delta: string
  done: boolean
}

export type ComplexityTier = 'low' | 'medium' | 'high'

export interface RoutingConfig {
  strategy?: 'static' | 'dynamic'
}

export interface ProviderEntry {
  name: string
  model?: string
  apiKey?: string
  baseUrl?: string
  models?: string[]
  priority?: number
}

/** Provider format override table: provider name → catalog format. */
export type CatalogFormatName = 'xml' | 'json' | 'text'

/** Skill discovery and catalog settings from `.agenthood/config.json`. */
export interface SkillsConfig {
  /** Catalog format when no provider-specific entry matches (#528, #556). */
  catalogFormat?: CatalogFormatName
  /** Per-provider catalog format (#556). */
  providerFormats?: Record<string, CatalogFormatName>
  /** Skills disabled by the user: filtered from the catalog and refused (#537). */
  disabled?: string[]
  /** `false` disables fallback activation chains (#613). */
  fallback?: boolean
  /** Per-script timeout, default 120000ms (#546). */
  scriptTimeoutMs?: number
  /** Cache successful bundled-script output; opt-in because a script may mutate state (#598). */
  cacheOutputs?: boolean
  /** Output cache TTL in ms, default 3600000 (#598). */
  cacheTtlMs?: number
}

/** One remote catalog (ADR-035). `tokenEnv` names an env var: never a literal token. */
export interface RemoteCatalogSource {
  url: string
  tokenEnv?: string
}

export interface RemoteCatalogsConfig {
  ttlSeconds?: number
  sources?: RemoteCatalogSource[]
}

export interface LLMConfig {  provider?: string
  model?: string
  embeddingModel?: string
  baseUrl?: string
  apiKey?: string
  routing?: RoutingConfig
  providers?: ProviderEntry[]
  failureThreshold?: number
  cooldownMs?: number
  probeEnabled?: boolean
  /** Per-request LLM call timeout in ms (default: 60000) */
  requestTimeoutMs?: number
  /** Skill auto-discovery toggle from .agenthood/config.json */
  skills?: SkillsConfig
  /** Remote `.well-known` skill catalogs (ADR-035) */
  remoteCatalogs?: RemoteCatalogsConfig
  /** Optional Sentry error reporting from .agenthood/config.json */
  sentry?: { dsn?: string }
  /** Mind-virus persistence-vector hardening from .agenthood/config.json (ADR-020) */
  security?: {
    strictSkillIntegrity?: boolean
    sandbox?: boolean
    dockerIsolation?: boolean
    /** Directories of activated skills are readable without a prompt (#536). */
    autoAllowSkillDirs?: boolean
    /** Authors whose scripts may run on the host (ADR-036). */
    trustedAuthors?: string[]
  }
  /**
   * Inject AGENTS.md / CLAUDE.md into every member prompt (#567). Default true;
   * a host whose AGENTS.md is contributor documentation sets it to false (#1071).
   */
  repoInstructions?: boolean
  /** Log full LLM request/response to .agenthood/debug/ */
  debug?: boolean
  /** Pause before each tool call for human confirmation */
  interactive?: boolean
}
