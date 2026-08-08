import type { LLMRequest } from "../types.ts"
import { validateMessages, validateTools } from "./validation.ts"
import type OpenAI from "openai"

/**
 * Shared complete() params for OpenAI-compatible providers.
 * OpenAI, OpenRouter, and Groq use buildCompleteParams directly.
 * OpenAI/OpenRouter use buildStreamParams for stream(); Groq passes
 * the full params to stream too. OpenCode diverges with custom
 * message/tool conversion and a smaller param set.
 */
export function buildCompleteParams(
  request: LLMRequest,
  model: string,
): Record<string, unknown> {
  return {
    model,
    messages: validateMessages<OpenAI.Chat.ChatCompletionMessageParam[]>(request.messages),
    tools: validateTools<OpenAI.Chat.ChatCompletionTool[]>(request.tools),
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
): Record<string, unknown> {
  return {
    model,
    messages: validateMessages<OpenAI.Chat.ChatCompletionMessageParam[]>(request.messages),
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
