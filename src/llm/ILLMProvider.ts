import type { LLMRequest, LLMResponse, LLMChunk } from './types.ts'

export interface ILLMProvider {
  complete(request: LLMRequest): Promise<LLMResponse>
  stream(request: LLMRequest): Promise<AsyncGenerator<LLMChunk>>
  embed(text: string): Promise<number[]>
  getContextWindow(): number
  /** The model this provider currently sends requests to (#551, #555). Optional for test doubles. */
  getModel?(): string
  setModel(model: string): void
}
