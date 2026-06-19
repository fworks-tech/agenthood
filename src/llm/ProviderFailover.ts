import type { ILLMProvider } from './ILLMProvider.js'
import type { LLMRequest, LLMResponse, LLMChunk } from './types.js'

export class AllProvidersFailedError extends Error {
  constructor(errors: string[]) {
    super(`All providers failed: ${errors.join('; ')}`)
    this.name = 'AllProvidersFailedError'
  }
}

export class ProviderChain implements ILLMProvider {
  constructor(private providers: ILLMProvider[]) {}

  async complete(request: LLMRequest): Promise<LLMResponse> {
    const errors: string[] = []
    for (const provider of this.providers) {
      try {
        return await provider.complete(request)
      } catch (err) {
        errors.push(`${provider.constructor.name}: ${err instanceof Error ? err.message : String(err)}`)
      }
    }
    throw new AllProvidersFailedError(errors)
  }

  async stream(request: LLMRequest): Promise<AsyncGenerator<LLMChunk>> {
    const errors: string[] = []
    for (const provider of this.providers) {
      try {
        return await provider.stream(request)
      } catch (err) {
        errors.push(`${provider.constructor.name}: ${err instanceof Error ? err.message : String(err)}`)
      }
    }
    throw new AllProvidersFailedError(errors)
  }

  async embed(text: string): Promise<number[]> {
    const errors: string[] = []
    for (const provider of this.providers) {
      try {
        return await provider.embed(text)
      } catch (err) {
        errors.push(`${provider.constructor.name}: ${err instanceof Error ? err.message : String(err)}`)
      }
    }
    throw new AllProvidersFailedError(errors)
  }
}
