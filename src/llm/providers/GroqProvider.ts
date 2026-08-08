import Groq from "groq-sdk";
import type { ILLMProvider } from "../ILLMProvider.ts"
import type { LLMRequest, LLMResponse, LLMChunk, LLMConfig } from "../types.ts"
import { UnsupportedOperationError } from "../errors.ts"
import { validateMessages, validateTools } from "./validation.ts"
import { createChatCompletionsHandler } from "./chat-completions.ts"
import type { ChatCompletionsHandler, ChatCompletionsClient } from "./chat-completions.ts"
import { DEFAULT_CONTEXT_WINDOW, GROQ_DEFAULT_MODEL } from "./constants.ts"

export class GroqProvider implements ILLMProvider {
  private client: Groq;
  private _model: string;
  private chat: ChatCompletionsHandler;

  get model(): string {
    return this._model;
  }

  constructor(config: LLMConfig) {
    this.client = new Groq({
      apiKey: config.apiKey ?? process.env.GROQ_API_KEY ?? "",
    });
    this._model =
      config.model ??
      process.env.GROQ_DEFAULT_MODEL ??
      GROQ_DEFAULT_MODEL;
    this.chat = createChatCompletionsHandler(
      this.client.chat.completions as unknown as ChatCompletionsClient,
      "Groq",
      () => this.model,
    );
  }

  async complete(request: LLMRequest): Promise<LLMResponse> {
    const startTime = Date.now();
    console.info(
      `[GroqProvider] complete() model=${this.model} messages=${request.messages.length}`,
    );

    try {
      const result = await this.chat.complete(this.buildCommonParams(request));

      console.info(
        `[GroqProvider] complete() ok model=${result.model} tokens=${result.usage.totalTokens} duration=${Date.now() - startTime}ms`,
      );
      return result;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(
        `[GroqProvider] complete() failed duration=${Date.now() - startTime}ms error=${msg}`,
      );
      throw err;
    }
  }

  async stream(request: LLMRequest): Promise<AsyncGenerator<LLMChunk>> {
    console.info(
      `[GroqProvider] stream() model=${this.model} messages=${request.messages.length}`,
    );

    return this.chat.stream(this.buildCommonParams(request));
  }

  private buildCommonParams(request: LLMRequest) {
    return {
      model: this.model,
      messages: validateMessages<Groq.Chat.Completions.ChatCompletionMessageParam[]>(request.messages),
      tools: validateTools<Groq.Chat.Completions.ChatCompletionTool[]>(request.tools),
      temperature: request.temperature,
      max_tokens: request.maxTokens,
      top_p: request.top_p,
      frequency_penalty: request.frequency_penalty,
      presence_penalty: request.presence_penalty,
      stop: request.stop,
    };
  }

  getContextWindow(): number {
    return DEFAULT_CONTEXT_WINDOW;
  }

  setModel(model: string): void {
    this._model = model;
  }

  async embed(_text: string): Promise<number[]> {
    throw new UnsupportedOperationError("embed", "GroqProvider");
  }
}
