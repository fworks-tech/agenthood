import type { LLMResponse, LLMChunk } from "../types.ts"
import type OpenAI from "openai"
import { parseToolCall, parseUsage } from "./validation.ts"
import { mapProviderError } from "./provider-errors.ts"
import { createStreamGenerator } from "./stream-utils.ts"
import { Logger } from "../../core/Logger.ts"

/**
 * Minimal interface over the SDK's chat.completions.create method.
 *
 * The OpenAI / Groq / OpenRouter SDKs expose overloaded create() signatures
 * that don't satisfy a generic Record<string, unknown> interface. The
 * adaptation cast lives once in ChatCompletionsProvider's constructor
 * (chat-completions-provider.ts) — it is safe because the handler only
 * forwards the params object through to the SDK, which already validates
 * them against its own overload.
 */
export interface ChatCompletionsClient {
  create(params: Record<string, unknown>): Promise<unknown>
}

export interface ChatCompletionsHandler {
  complete(params: Record<string, unknown>): Promise<LLMResponse>
  stream(params: Record<string, unknown>): Promise<AsyncGenerator<LLMChunk>>
}

export function createChatCompletionsHandler(
  client: ChatCompletionsClient,
  providerName: string,
  getModel: () => string,
): ChatCompletionsHandler {
  // Provider-level structured logging: every API call leaves an entry in the
  // shared NDJSON store (failures at error level, successes at debug level so
  // routine calls stay quiet), satisfying incident-response and cost review
  // without duplicating the per-member trace envelopes.
  const logger = new Logger({ source: "api" })

  async function complete(params: Record<string, unknown>): Promise<LLMResponse> {
    const start = performance.now()
    try {
      const response = (await client.create(params)) as OpenAI.Chat.ChatCompletion
      const choice = response.choices?.[0]
      const message = choice?.message
      if (!message) {
        throw new Error(`${providerName} API returned empty choices array`)
      }
      const toolCalls = message.tool_calls?.map((tc: { id: string; type: string; function?: { name: string; arguments: string } }) =>
        parseToolCall(tc, providerName),
      )
      const result: LLMResponse = {
        content: message.content ?? "",
        toolCalls,
        usage: parseUsage(response.usage),
        model: response.model ?? "",
      }
      await logger.debug(`${providerName} call completed`, providerName, {
        model: result.model,
        durationMs: Math.round(performance.now() - start),
        tokens: result.usage?.totalTokens ?? 0,
      })
      return result
    } catch (err) {
      await logger.error(`${providerName} call failed`, providerName, {
        model: getModel(),
        durationMs: Math.round(performance.now() - start),
        error: err instanceof Error ? err.message : String(err),
      })
      throw mapProviderError(err, providerName, getModel())
    }
  }

  async function stream(params: Record<string, unknown>): Promise<AsyncGenerator<LLMChunk>> {
    const start = performance.now()
    try {
      // Verify the SDK returned an async iterable before narrowing the type —
      // the same verify-then-cast pattern validation.ts uses for messages.
      const raw: unknown = await client.create({ ...params, stream: true })
      if (typeof (raw as AsyncIterable<unknown>)?.[Symbol.asyncIterator] !== "function") {
        throw new Error(`${providerName} API did not return an async iterable stream`)
      }
      await logger.debug(`${providerName} stream opened`, providerName, {
        model: getModel(),
        durationMs: Math.round(performance.now() - start),
      })
      return createStreamGenerator(
        raw as AsyncIterable<OpenAI.Chat.ChatCompletionChunk>,
        (chunk) => chunk.choices?.[0]?.delta?.content ?? "",
      )
    } catch (err) {
      await logger.error(`${providerName} stream failed`, providerName, {
        model: getModel(),
        durationMs: Math.round(performance.now() - start),
        error: err instanceof Error ? err.message : String(err),
      })
      throw mapProviderError(err, providerName, getModel())
    }
  }

  return { complete, stream }
}
