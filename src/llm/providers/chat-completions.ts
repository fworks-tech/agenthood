import type { LLMResponse, LLMChunk } from "../types.ts"
import { parseToolCall, parseUsage } from "./validation.ts"
import { mapProviderError } from "./provider-errors.ts"
import { createStreamGenerator } from "./stream-utils.ts"

export interface ChatCompletionsClient {
  create(params: Record<string, unknown>): Promise<unknown>
}

interface ChatCompletionChoice {
  message?: {
    content?: string | null
    tool_calls?: Array<{
      id: string
      type: string
      function?: { name: string; arguments: string }
    }>
  }
}

interface ChatCompletionResponse {
  choices?: ChatCompletionChoice[]
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number }
  model?: string
}

interface StreamChunk {
  choices?: Array<{ delta?: { content?: string | null } }>
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
      const response = (await client.create(params)) as ChatCompletionResponse
      const choice = response.choices?.[0]
      const message = choice?.message
      if (!message) {
        throw new Error(`${providerName} API returned empty choices array`)
      }
      const toolCalls = message.tool_calls?.map((tc) => parseToolCall(tc, providerName))
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
      const stream = (await client.create({ ...params, stream: true })) as unknown as AsyncIterable<StreamChunk>
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
