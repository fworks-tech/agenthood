import type { ExecutionContext } from '../../core/ExecutionContext.js'
import type { IProtocol, ProtocolConfig, FailureAction } from './IProtocol.js'

const DEFAULT_CONFIG: ProtocolConfig = {
  retryPolicy: { maxRetries: 2, backoffMs: 1000 },
  timeoutMs: 30000,
}

export interface AgentProtocolInput {
  agentName: string
  task: string
}

export interface AgentProtocolOutput {
  output: string
}

export class AgentProtocol implements IProtocol<AgentProtocolInput, AgentProtocolOutput> {
  name = 'agent-protocol'
  config: ProtocolConfig

  constructor(config?: Partial<ProtocolConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  async execute(input: AgentProtocolInput, _context: ExecutionContext): Promise<AgentProtocolOutput> {
    console.log(`\n[AgentProtocol] Routing to "${input.agentName}": ${input.task}\n`)
    return { output: `Delegated to ${input.agentName}` }
  }

  onFailure(_error: Error, attempt: number): FailureAction {
    const maxRetries = this.config.retryPolicy.maxRetries
    if (attempt < maxRetries) return 'retry'
    return 'abort'
  }
}
