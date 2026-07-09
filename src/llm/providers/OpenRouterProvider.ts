import OpenAI from "openai";
import type { ILLMProvider } from "../ILLMProvider.ts"
import type {
  LLMRequest,
  LLMResponse,
  LLMChunk,
  LLMConfig,
} from "../types.ts"
import { createStreamGenerator } from "./stream-utils.ts"
import { validateMessages, validateTools, parseToolCall, parseUsage } from "./validation.ts"
import { mapProviderError } from "./provider-errors.ts"

export class OpenRouterProvider implements ILLMProvider {
  private client: OpenAI;
  private model: string;

  constructor(config: LLMConfig) {
    this.client = new OpenAI({
      apiKey: config.apiKey ?? process.env.OPENROUTER_API_KEY,
      baseURL: config.baseUrl ?? "https://openrouter.ai/api/v1",
    });
    this.model = config.model ?? "openai/gpt-4o-mini";
  }

  async complete(request: LLMRequest): Promise<LLMResponse> {
    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: validateMessages<OpenAI.Chat.ChatCompletionMessageParam[]>(request.messages),
        tools: validateTools<OpenAI.Chat.ChatCompletionTool[]>(request.tools),
        temperature: request.temperature,
        max_tokens: request.maxTokens,
        top_p: request.top_p,
        frequency_penalty: request.frequency_penalty,
        presence_penalty: request.presence_penalty,
        stop: request.stop ?? undefined,
      });

      const choice = response.choices[0];
      const message = choice.message;
      const toolCalls = message.tool_calls?.map(
        (tc) => parseToolCall(tc, "OpenRouter"),
      );

      return {
        content: message.content ?? "",
        toolCalls,
        usage: parseUsage(response.usage),
        model: response.model,
      };
    } catch (err) {
      throw mapProviderError(err, "OpenRouter", this.model);
    }
  }

  async stream(request: LLMRequest): Promise<AsyncGenerator<LLMChunk>> {
    const stream = await this.client.chat.completions.create({
      model: this.model,
      messages: validateMessages<OpenAI.Chat.ChatCompletionMessageParam[]>(request.messages),
      temperature: request.temperature,
      max_tokens: request.maxTokens,
      stream: true,
    });

    return createStreamGenerator(
      stream as unknown as AsyncIterable<OpenAI.Chat.ChatCompletionChunk>,
      (chunk) => chunk.choices[0]?.delta?.content ?? "",
    );
  }

  getContextWindow(): number {
    return 200000;
  }

  setModel(model: string): void {
    this.model = model;
  }

  async embed(text: string): Promise<number[]> {
    try {
      const response = await this.client.embeddings.create({
        model: "openai/text-embedding-3-small",
        input: text,
      });
      return response.data[0].embedding;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`OpenRouterProvider.embed() failed: ${msg}`);
    }
  }
}
