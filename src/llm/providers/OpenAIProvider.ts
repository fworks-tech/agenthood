import OpenAI from "openai";
import type { LLMConfig } from "../types.ts"
import { ChatCompletionsProvider } from "./chat-completions-provider.ts"
import type { ChatCompletionsProviderOptions } from "./chat-completions-provider.ts"
import { DEFAULT_CONTEXT_WINDOW, OPENAI_DEFAULT_MODEL, OPENAI_EMBEDDING_MODEL } from "./constants.ts"

export class OpenAIProvider extends ChatCompletionsProvider {
  constructor(config: LLMConfig) {
    const options: ChatCompletionsProviderOptions = {
      providerName: "OpenAI",
      apiKeyEnv: "OPENAI_API_KEY",
      defaultModel: OPENAI_DEFAULT_MODEL,
      defaultEmbeddingModel: OPENAI_EMBEDDING_MODEL,
      contextWindow: DEFAULT_CONTEXT_WINDOW,
      createClient: (apiKey, baseUrl) => new OpenAI({ apiKey, baseURL: baseUrl }),
    };
    super(config, options);
  }

  async embed(text: string): Promise<number[]> {
    return this.embedWithOpenAI(text)
  }
}
