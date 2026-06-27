import type { ExecutionContext } from '../../core/ExecutionContext.js'
import type { ISkill } from '../../skills/ISkill.js'
import { RiskManager } from '../../core/RiskManager.js'
import type { IProtocol, ProtocolConfig, FailureAction } from './IProtocol.js'

const DEFAULT_CONFIG: ProtocolConfig = {
  retryPolicy: { maxRetries: 1, backoffMs: 500 },
  timeoutMs: 30000,
}

export interface ToolProtocolInput {
  skill: ISkill
  input: unknown
}

export interface ToolProtocolOutput {
  result: unknown
}

export class ToolProtocol implements IProtocol<ToolProtocolInput, ToolProtocolOutput> {
  name = 'tool-protocol'
  config: ProtocolConfig
  private riskManager: RiskManager

  constructor(config?: Partial<ProtocolConfig>, riskManager?: RiskManager) {
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.riskManager = riskManager ?? new RiskManager()
  }

  async execute(input: ToolProtocolInput, context: ExecutionContext): Promise<ToolProtocolOutput> {
    const violation = this.riskManager.validate(input.skill, input.input)
    if (violation) {
      throw new Error(`Risk violation: [${violation.type}] ${violation.reason}`)
    }

    const wrapped = this.riskManager.wrap(
      (skillInput: unknown, _ctx: unknown) => input.skill.execute(skillInput, context),
    )

    const result = await wrapped(input.input, context)
    return { result }
  }

  onFailure(_error: Error, _attempt: number): FailureAction {
    return 'abort'
  }
}
