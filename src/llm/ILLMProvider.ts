import type { LLMRequest, LLMResponse, LLMChunk } from './types.js'

export interface ILLMProvider {
  complete(request: LLMRequest): Promise<LLMResponse>
  stream(request: LLMRequest): Promise<AsyncGenerator<LLMChunk>>
  embed(text: string): Promise<number[]>
}
