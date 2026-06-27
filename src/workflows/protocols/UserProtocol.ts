import type { ExecutionContext } from '../../core/ExecutionContext.js'
import type { IProtocol, ProtocolConfig, FailureAction } from './IProtocol.js'

const DEFAULT_CONFIG: ProtocolConfig = {
  retryPolicy: { maxRetries: 2, backoffMs: 1000 },
  timeoutMs: 30000,
}

export interface UserProtocolInput {
  message: string
  options?: string[]
}

export interface UserProtocolOutput {
  approved: boolean
  response?: string
  selectedOption?: string
}

export class UserProtocol implements IProtocol<UserProtocolInput, UserProtocolOutput> {
  name = 'user-protocol'
  config: ProtocolConfig

  constructor(config?: Partial<ProtocolConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  async execute(input: UserProtocolInput, context: ExecutionContext): Promise<UserProtocolOutput> {
    const msg = input.options?.length
      ? `${input.message}\n\nOptions:\n${input.options.map((o, i) => `${i + 1}. ${o}`).join('\n')}`
      : input.message

    console.log(`\n[UserProtocol] ${msg}\n`)
    console.log('  Waiting for approval... (simulated: auto-approved)\n')

    return { approved: true, response: 'Approved' }
  }

  onFailure(_error: Error, _attempt: number): FailureAction {
    return 'escalate'
  }
}
