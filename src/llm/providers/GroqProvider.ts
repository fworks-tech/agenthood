import Groq from "groq-sdk";
import type { ILLMProvider } from "../ILLMProvider.ts"
import type { LLMRequest, LLMResponse, LLMChunk, LLMConfig } from "../types.ts"
import { UnsupportedOperationError } from "../errors.ts"
import { createChatCompletionsHandler } from "./chat-completions.ts"
import type { ChatCompletionsHandler, ChatCompletionsClient } from "./chat-completions.ts"
import { buildCompleteParams } from "./openai-params.ts"
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
    return this.chat.complete(buildCompleteParams(request, this.model));
  }

  async stream(request: LLMRequest): Promise<AsyncGenerator<LLMChunk>> {
    return this.chat.stream(buildCompleteParams(request, this.model));
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
