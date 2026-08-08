import type { LLMRequest, Message, ToolSchema } from "../types.ts"
import { validateMessages, validateTools } from "./validation.ts"
import type OpenAI from "openai"

export interface ParamConverters {
  /** Custom message converter (e.g., toOpenAIMessages for OpenCode). */
  convertMessages?: (messages: Message[]) => unknown
  /** Custom tool converter (e.g., inputSchema → parameters rename). */
  convertTools?: (tools: ToolSchema[]) => unknown
}

/**
 * Shared complete() params for OpenAI-compatible providers, called by
 * ChatCompletionsProvider. OpenAI/OpenRouter/Groq use buildCompleteParams
 * for complete(); Groq also passes the full params to stream(). OpenCode
 * passes custom converters.
 */
export function buildCompleteParams(
  request: LLMRequest,
  model: string,
  converters?: ParamConverters,
): Record<string, unknown> {
  const messages = converters?.convertMessages
    ? converters.convertMessages(request.messages)
    : validateMessages<OpenAI.Chat.ChatCompletionMessageParam[]>(request.messages)
  const tools = converters?.convertTools && request.tools
    ? converters.convertTools(request.tools)
    : validateTools<OpenAI.Chat.ChatCompletionTool[]>(request.tools)
  return {
    model,
    messages,
    tools,
    temperature: request.temperature,
    max_tokens: request.maxTokens,
    top_p: request.top_p,
    frequency_penalty: request.frequency_penalty,
    presence_penalty: request.presence_penalty,
    stop: request.stop ?? undefined,
  }
}

/** Shared stream() params — a subset of complete params (no tools, penalties, or stop). */
export function buildStreamParams(
  request: LLMRequest,
  model: string,
  converters?: Pick<ParamConverters, "convertMessages">,
): Record<string, unknown> {
  const messages = converters?.convertMessages
    ? converters.convertMessages(request.messages)
    : validateMessages<OpenAI.Chat.ChatCompletionMessageParam[]>(request.messages)
  return {
    model,
    messages,
    temperature: request.temperature,
    max_tokens: request.maxTokens,
  }
}

/** Shared embed() logic for OpenAI-compatible providers. */
export async function embedWith(
  client: OpenAI,
  model: string,
  text: string,
  providerName: string,
): Promise<number[]> {
  try {
    const response = await client.embeddings.create({ model, input: text })
    return response.data[0].embedding
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    throw new Error(`${providerName} embed failed: ${msg}`)
  }
}
