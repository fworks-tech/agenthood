import Groq from "groq-sdk";
import type { LLMConfig } from "../types.ts"
import { ChatCompletionsProvider } from "./chat-completions-provider.ts"
import type { ChatCompletionsProviderOptions } from "./chat-completions-provider.ts"
import { DEFAULT_CONTEXT_WINDOW, GROQ_DEFAULT_MODEL } from "./constants.ts"

export class GroqProvider extends ChatCompletionsProvider {
  constructor(config: LLMConfig) {
    const options: ChatCompletionsProviderOptions = {
      providerName: "Groq",
      apiKeyEnv: "GROQ_API_KEY",
      // Fail fast at construction with a clear MissingApiKeyError instead of
      // letting the SDK build with an empty key and surface a generic 401 later
      requireApiKey: true,
      signupUrl: "https://console.groq.com",
      envModelVar: "GROQ_DEFAULT_MODEL",
      defaultModel: GROQ_DEFAULT_MODEL,
      contextWindow: DEFAULT_CONTEXT_WINDOW,
      streamUsesCompleteParams: true,
      createClient: (apiKey) => new Groq({ apiKey }),
    };
    super(config, options);
  }

  get model(): string {
    return this._model;
  }
}
