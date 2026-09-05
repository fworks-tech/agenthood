import type OpenAI from "openai"
import type { ILLMProvider } from "../ILLMProvider.ts"
import type { LLMRequest, LLMResponse, LLMChunk, LLMConfig } from "../types.ts"
import { UnsupportedOperationError } from "../errors.ts"
import { MissingApiKeyError } from "../validateApiKeys.ts"
import { validateMessages } from "./validation.ts"
import { createChatCompletionsHandler } from "./chat-completions.ts"
import type { ChatCompletionsHandler, ChatCompletionsClient } from "./chat-completions.ts"
import {
  buildCompleteParams,
  buildStreamParams,
  embedWith,
  type CompleteParamsBuilder,
} from "./openai-params.ts"
import type { ParamConverters } from "./openai-params.ts"
import { writeDebugDump } from "../debug-dump.ts"

/**
 * Shared constructor options for OpenAI-compatible providers.
 *
 * `createClient` returns the provider's SDK client (OpenAI or Groq). The base
 * reads `client.chat.completions` and adapts it to `ChatCompletionsClient` in
 * one place, instead of repeating the double-cast at every call site.
 */
export interface ChatCompletionsProviderOptions {
  providerName: string
  /** Env var holding the API key (e.g. OPENAI_API_KEY). */
  apiKeyEnv: string
  /** Default base URL when config.baseUrl is unset. */
  baseUrlDefault?: string
  /** Throw MissingApiKeyError at construction when no key resolves. */
  requireApiKey?: boolean
  /** Docs URL for the missing-key error message. */
  signupUrl?: string
  /** Model when config.model (and envModelVar) are unset. */
  defaultModel: string
  /** Env var for a model default (e.g. GROQ_DEFAULT_MODEL). */
  envModelVar?: string
  /** Embedding model when config.embeddingModel is unset. */
  defaultEmbeddingModel?: string
  contextWindow: number
  /** Custom message/tool converters (e.g. OpenCode). */
  converters?: ParamConverters
  /** Alternate body builder (e.g. OpenCode Go strips sampling extras). */
  paramsBuilder?: CompleteParamsBuilder
  /** Groq passes the full complete params to stream(). */
  streamUsesCompleteParams?: boolean
  /** Construct the provider's SDK client. */
  createClient: (apiKey: string, baseUrl: string | undefined) => unknown
}

/**
 * Base class for OpenAI-compatible chat-completions providers (OpenAI,
 * OpenRouter, Groq, OpenCode). Collapses the per-provider constructor,
 * complete/stream/getContextWindow/setModel/embed skeleton into one place.
 *
 * The SDK client's overloaded `chat.completions.create()` does not satisfy
 * the generic `ChatCompletionsClient` interface, so the adaptation cast is
 * done here once and documented — it is safe because the handler only
 * forwards the params object through to the SDK, which validates it against
 * its own overload.
 */
export abstract class ChatCompletionsProvider implements ILLMProvider {
  protected readonly client: unknown
  protected _model: string
  protected embeddingModel: string | undefined
  protected readonly providerName: string

  private readonly contextWindow: number
  private readonly converters: ParamConverters | undefined
  private readonly paramsBuilder: CompleteParamsBuilder
  private readonly streamUsesCompleteParams: boolean
  private readonly chat: ChatCompletionsHandler
  private readonly debug: boolean
  private debugProjectDir = process.cwd()

  constructor(config: LLMConfig, options: ChatCompletionsProviderOptions) {
    const apiKey = config.apiKey ?? process.env[options.apiKeyEnv] ?? ""
    if (options.requireApiKey && !apiKey) {
      throw new MissingApiKeyError(options.providerName, options.apiKeyEnv, options.signupUrl ?? "")
    }
    this.client = options.createClient(apiKey, config.baseUrl ?? options.baseUrlDefault)
    this.providerName = options.providerName
    this.contextWindow = options.contextWindow
    this.converters = options.converters
    this.paramsBuilder = options.paramsBuilder ?? buildCompleteParams
    this.streamUsesCompleteParams = options.streamUsesCompleteParams ?? false
    this.debug = config.debug ?? false
    this._model =
      config.model ??
      (options.envModelVar ? process.env[options.envModelVar] : undefined) ??
      options.defaultModel
    this.embeddingModel = config.embeddingModel ?? options.defaultEmbeddingModel
    const completions = (
      this.client as { chat: { completions: ChatCompletionsClient } }
    ).chat.completions
    this.chat = createChatCompletionsHandler(completions, options.providerName, () => this._model)
  }

  setDebugProjectDir(dir: string): void {
    this.debugProjectDir = dir
  }

  async complete(request: LLMRequest): Promise<LLMResponse> {
    if (this.converters) {
      validateMessages(request.messages)
    }
    const start = performance.now()
    const response = await this.chat.complete(this.paramsBuilder(request, this._model, this.converters))
    if (this.debug) {
      writeDebugDump(this.debugProjectDir, undefined, this.providerName, this._model, request, response, Math.round(performance.now() - start))
    }
    return response
  }

  async stream(request: LLMRequest): Promise<AsyncGenerator<LLMChunk>> {
    if (this.converters) {
      validateMessages(request.messages)
    }
    const params = this.streamUsesCompleteParams
      ? this.paramsBuilder(request, this._model, this.converters)
      : buildStreamParams(request, this._model, this.converters)
    return this.chat.stream(params)
  }

  getContextWindow(): number {
    return this.contextWindow
  }

  setModel(model: string): void {
    this._model = model
  }

  async embed(_text: string): Promise<number[]> {
    throw new UnsupportedOperationError("embed", this.providerName)
  }

  /** Subclasses with an OpenAI-compatible embeddings API override this. */
  protected embedWithOpenAI(text: string): Promise<number[]> {
    return embedWith(this.client as OpenAI, this.embeddingModel ?? "", text, this.providerName)
  }
}
