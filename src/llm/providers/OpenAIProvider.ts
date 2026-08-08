import OpenAI from "openai";
import type { ILLMProvider } from "../ILLMProvider.ts"
import type {
  LLMRequest,
  LLMResponse,
  LLMChunk,
  LLMConfig,
} from "../types.ts"
import { createChatCompletionsHandler } from "./chat-completions.ts"
import type { ChatCompletionsHandler, ChatCompletionsClient } from "./chat-completions.ts"
import { buildCompleteParams, buildStreamParams } from "./openai-params.ts"
import { DEFAULT_CONTEXT_WINDOW, OPENAI_DEFAULT_MODEL, OPENAI_EMBEDDING_MODEL } from "./constants.ts"

export class OpenAIProvider implements ILLMProvider {
  private client: OpenAI;
  private model: string;
  private embeddingModel: string;
  private chat: ChatCompletionsHandler;

  constructor(config: LLMConfig) {
    this.client = new OpenAI({
      apiKey: config.apiKey ?? process.env.OPENAI_API_KEY,
      baseURL: config.baseUrl,
    });
    this.model = config.model ?? OPENAI_DEFAULT_MODEL;
    this.embeddingModel = config.embeddingModel ?? OPENAI_EMBEDDING_MODEL;
    this.chat = createChatCompletionsHandler(
      this.client.chat.completions as unknown as ChatCompletionsClient,
      "OpenAI",
      () => this.model,
    );
  }

  async complete(request: LLMRequest): Promise<LLMResponse> {
    return this.chat.complete(buildCompleteParams(request, this.model))
  }

  async stream(request: LLMRequest): Promise<AsyncGenerator<LLMChunk>> {
    return this.chat.stream(buildStreamParams(request, this.model))
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
