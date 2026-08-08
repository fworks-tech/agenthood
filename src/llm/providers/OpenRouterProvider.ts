import OpenAI from "openai";
import type { LLMConfig } from "../types.ts"
import { ChatCompletionsProvider } from "./chat-completions-provider.ts"
import type { ChatCompletionsProviderOptions } from "./chat-completions-provider.ts"
import { OPENROUTER_DEFAULT_MODEL, OPENROUTER_CONTEXT_WINDOW, OPENROUTER_EMBEDDING_MODEL } from "./constants.ts"

export class OpenRouterProvider extends ChatCompletionsProvider {
  constructor(config: LLMConfig) {
    const options: ChatCompletionsProviderOptions = {
      providerName: "OpenRouter",
      apiKeyEnv: "OPENROUTER_API_KEY",
      baseUrlDefault: "https://openrouter.ai/api/v1",
      defaultModel: OPENROUTER_DEFAULT_MODEL,
      defaultEmbeddingModel: OPENROUTER_EMBEDDING_MODEL,
      contextWindow: OPENROUTER_CONTEXT_WINDOW,
      createClient: (apiKey, baseUrl) => new OpenAI({ apiKey, baseURL: baseUrl }),
    };
    super(config, options);
  }

  async embed(text: string): Promise<number[]> {
    return this.embedWithOpenAI(text)
  }
}
