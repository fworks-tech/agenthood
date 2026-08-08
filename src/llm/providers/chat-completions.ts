import type { LLMResponse, LLMChunk } from "../types.ts"
import type OpenAI from "openai"
import { parseToolCall, parseUsage } from "./validation.ts"
import { mapProviderError } from "./provider-errors.ts"
import { createStreamGenerator } from "./stream-utils.ts"

/**
 * Minimal interface over the SDK's chat.completions.create method.
 *
 * The OpenAI / Groq / OpenRouter SDKs expose overloaded create() signatures
 * that don't satisfy a generic Record<string, unknown> interface. At every
 * call site the SDK client is double-cast (`as unknown as ChatCompletionsClient`)
 * — this is safe because the handler only forwards the params object through
 * to the SDK, which already validates them against its own overload.
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
  async function complete(params: Record<string, unknown>): Promise<LLMResponse> {
    try {
      const response = (await client.create(params)) as OpenAI.Chat.Completion
      const choice = response.choices?.[0]
      const message = choice?.message
      if (!message) {
        throw new Error(`${providerName} API returned empty choices array`)
      }
      const toolCalls = message.tool_calls?.map((tc) =>
        parseToolCall(tc as { id: string; type: string; function?: { name: string; arguments: string } }, providerName),
      )
      return {
        content: message.content ?? "",
        toolCalls,
        usage: parseUsage(response.usage),
        model: response.model ?? "",
      }
    } catch (err) {
      throw mapProviderError(err, providerName, getModel())
    }
  }

  async function stream(params: Record<string, unknown>): Promise<AsyncGenerator<LLMChunk>> {
    try {
      const stream = (await client.create({ ...params, stream: true })) as unknown as AsyncIterable<OpenAI.Chat.ChatCompletionChunk>
      return createStreamGenerator(
        stream,
        (chunk) => chunk.choices?.[0]?.delta?.content ?? "",
      )
    } catch (err) {
      throw mapProviderError(err, providerName, getModel())
    }
  }

  return { complete, stream }
}
