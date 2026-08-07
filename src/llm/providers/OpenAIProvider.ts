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
import { DEFAULT_CONTEXT_WINDOW, OPENAI_DEFAULT_MODEL, OPENAI_EMBEDDING_MODEL } from "./constants.ts"

export class OpenAIProvider implements ILLMProvider {
  private client: OpenAI;
  private model: string;
  private embeddingModel: string;

  constructor(config: LLMConfig) {
    this.client = new OpenAI({
      apiKey: config.apiKey ?? process.env.OPENAI_API_KEY,
      baseURL: config.baseUrl,
    });
    this.model = config.model ?? OPENAI_DEFAULT_MODEL;
    this.embeddingModel = config.embeddingModel ?? OPENAI_EMBEDDING_MODEL;
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
        (tc) => parseToolCall(tc, "OpenAI"),
      );

      return {
        content: message.content ?? "",
        toolCalls,
        usage: parseUsage(response.usage),
        model: response.model,
      };
    } catch (err) {
      throw mapProviderError(err, "OpenAI", this.model);
    }
  }

  async stream(request: LLMRequest): Promise<AsyncGenerator<LLMChunk>> {
    try {
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
    } catch (err) {
      throw mapProviderError(err, "OpenAI", this.model);
    }
  }

  getContextWindow(): number {
    return DEFAULT_CONTEXT_WINDOW
  }

  setModel(model: string): void {
    this.model = model
  }

  async embed(text: string): Promise<number[]> {
    try {
      const response = await this.client.embeddings.create({
        model: this.embeddingModel,
        input: text,
      });
      return response.data[0].embedding;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`OpenAIProvider.embed() failed: ${msg}`);
    }
  }
}
