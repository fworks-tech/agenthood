import type { ILLMProvider } from './ILLMProvider.js'
import type { LLMConfig } from './types.js'
import { GroqProvider } from './providers/GroqProvider.js'
import { OllamaProvider } from './providers/OllamaProvider.js'
import { OpenAIProvider } from './providers/OpenAIProvider.js'
import { AnthropicProvider } from './providers/AnthropicProvider.js'

export class LLMRouter {
  static create(config: LLMConfig): ILLMProvider {
    switch (config.provider) {
      case 'groq':
        return new GroqProvider(config)
      case 'ollama':
        return new OllamaProvider(config)
      case 'openai':
        return new OpenAIProvider(config)
      case 'anthropic':
        return new AnthropicProvider(config)
      default:
        return new GroqProvider(config)
    }
  }
}
