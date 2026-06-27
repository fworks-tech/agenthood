import type { ExecutionContext } from '../../core/ExecutionContext.js'

export interface ProtocolConfig {
  retryPolicy: {
    maxRetries: number
    backoffMs: number
  }
  timeoutMs: number
}

export type FailureAction = 'retry' | 'abort' | 'escalate'

export interface IProtocol<TInput, TOutput> {
  name: string
  config: ProtocolConfig
  execute(input: TInput, context: ExecutionContext): Promise<TOutput>
  onFailure(error: Error, attempt: number): FailureAction
}
