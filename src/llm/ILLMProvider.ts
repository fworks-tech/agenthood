import type { LLMRequest, LLMResponse, LLMChunk } from './types.ts'

export interface ILLMProvider {
  complete(request: LLMRequest): Promise<LLMResponse>
  stream(request: LLMRequest): Promise<AsyncGenerator<LLMChunk>>
  embed(text: string): Promise<number[]>
  getContextWindow(): number
  setModel(model: string): void
}
